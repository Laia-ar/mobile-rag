/**
 * useSQLiteRAG
 *
 * Hook para React Native que inicializa una base de datos SQLite usando
 * @op-engineering/op-sqlite, carga una DB pre-construida desde los assets
 * del bundle en el primer arranque, y expone búsqueda por similitud coseno
 * ejecutada enteramente en SQLite via sqlite-vec (C++ nativo, sin cómputo en JS).
 *
 * ─── Dependencias ─────────────────────────────────────────────────────────────
 *   npm install @op-engineering/op-sqlite
 *   npx react-native-asset@latest   ← vincula los assets
 *   npx pod-install                 ← iOS
 *
 * ─── Habilitar sqlite-vec en package.json ─────────────────────────────────────
 *   "op-sqlite": {
 *     "sqliteVec": true
 *   }
 *
 * ─── Ubicación del archivo bundleado ──────────────────────────────────────────
 *   1. Crear la carpeta  assets/  en la raíz del proyecto
 *   2. Poner el archivo  assets/<assetDbName>  ahí
 *   3. En react-native.config.js:
 *        module.exports = { assets: ['./assets/'] };
 *   4. Correr:  npx react-native-asset@latest
 *
 * ─── Formato esperado de la tabla de embeddings ───────────────────────────────
 *   CREATE VIRTUAL TABLE vec_chunks (
 *     chunk_id    TEXT PRIMARY KEY,
 *     embedding   FLOAT[dim],
 *     document_id TEXT,
 *     content     TEXT,
 *     metadata    TEXT   -- JSON opcional, ej. {"document_title":"..."}
 *   );
 *
 * ─── Similitud coseno ─────────────────────────────────────────────────────────
 *   sqlite-vec expone la función SQL  vec_distance_cosine(a, b)  que corre
 *   completamente en C++ en el hilo nativo de op-sqlite. No hay cómputo
 *   vectorial en el hilo de JavaScript.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  open,
  DB,
  Scalar,
} from '@op-engineering/op-sqlite';
import RNFS from 'react-native-fs';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface SimilarityResult {
  title: string;
  content: string;
  similarity: number;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowsAffected: number;
  insertId?: number;
}

export interface UseSQLiteRAGOptions {
  /**
   * Nombre del archivo .sqlite en la carpeta assets/ del proyecto.
   * @default "rag_database.sqlite"
   */
  assetDbName?: string;

  /**
   * Nombre de la tabla virtual que contiene los embeddings.
   * @default "vec_chunks"
   */
  embeddingTable?: string;

  /**
   * Dimensión de los vectores de embeddings (debe coincidir con la tabla).
   * @default 384
   */
  embeddingDim?: number;
}

export interface UseSQLiteRAGReturn {
  /** true mientras la DB se está inicializando */
  loading: boolean;
  /** Error de inicialización o de la última operación, null si no hay error */
  error: Error | null;
  /** true cuando la DB está abierta y lista para consultas */
  isReady: boolean;

  similaritySearch: (
    question: string,
    queryEmbedding: number[],
    topK?: number,
    threshold?: number,
  ) => Promise<SimilarityResult[]>;

  query: <T = Record<string, unknown>>(
    sql: string,
    params?: Scalar[],
  ) => Promise<QueryResult<T>>;
}

// ─── Helper: number[] → Float32 ArrayBuffer ───────────────────────────────────

/**
 * Serializa un array de floats JS a ArrayBuffer en formato Float32 little-endian.
 * op-sqlite acepta ArrayBuffer / TypedArray directamente como parámetro BLOB.
 */
function toFloat32Buffer(values: number[]): ArrayBuffer {
  const buf = new ArrayBuffer(values.length * 4);
  const view = new DataView(buf);
  values.forEach((v, i) => view.setFloat32(i * 4, v, /* littleEndian= */ true));
  return buf;
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useSQLiteRAG(
  options: UseSQLiteRAGOptions = {},
): UseSQLiteRAGReturn {
  const {
    assetDbName = 'rag_database.sqlite',
    embeddingTable = 'vec_chunks',
    embeddingDim = 384,
  } = options;

  const dbRef = useRef<DB | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ── Inicialización ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setIsReady(false);

        if (cancelled) return;

        const file = basename(assetDbName);
        const source = assetDbName;
        const folder = `${RNFS.TemporaryDirectoryPath}/db`;
        const dest = `${folder}/${file}`;
        const present = await RNFS.exists(dest);
        if (!present) {
          console.log('[useSQLiteRAG] copy DB to', dest);
          const exists = await RNFS.existsAssets(source);
          if (!exists) throw new Error(`Archivo no encontrado: ${source}`);
          await RNFS.mkdir(folder);
          await RNFS.copyFileAssets(source, dest);
          const copied = await RNFS.exists(dest);
          if (!copied) throw new Error(`Archivo no fue copiado: ${source}`);
        }
        console.log('[useSQLiteRAG] open', dest);
        const db = open({ name: file, location: folder });

        const path = db.getDbPath();
        console.log('[useSQLiteRAG] db path', path);
        await db.execute("PRAGMA encoding     = 'UTF-8';");
        await db.execute('PRAGMA auto_vacuum  = NONE;');
        await db.execute('PRAGMA foreign_keys = false;');
        await db.execute('PRAGMA fullfsync    = false;');
        await db.execute('PRAGMA locking_mode = EXCLUSIVE;');
        await db.execute('PRAGMA query_only   = true;');
        await db.execute('PRAGMA journal_mode = OFF;'); // read only database
        await db.execute('PRAGMA synchronous  = OFF;');
        await db.execute('PRAGMA temp_store   = MEMORY;');
        await db.execute('PRAGMA mmap_size    = 402653184;'); // 384 MB mmap
        await db.execute('PRAGMA integrity_check;');

        if (cancelled) {
          db.close();
          return;
        }

        dbRef.current = db;
        setIsReady(true);
      } catch (err) {
        if (!cancelled) {
          const e = err instanceof Error ? err : new Error(String(err));
          setError(e);
          console.error('[useSQLiteRAG] init error:');
          console.log('name:', e.name);
          console.log('message:', e.message);
          console.log('stack:', e.stack);
          console.log(
            'full:',
            JSON.stringify(e, Object.getOwnPropertyNames(e)),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetDbName]);

  // ── Guard ───────────────────────────────────────────────────────────────────

  const requireDb = (): DB => {
    if (!dbRef.current) {
      throw new Error('[useSQLiteRAG] La base de datos no está lista todavía.');
    }
    return dbRef.current;
  };

  // ── similaritySearch ────────────────────────────────────────────────────────

  const similaritySearch = useCallback(
    async (
      question: string,
      queryEmbedding: number[],
      topK = 5,
      threshold = 0.0,
    ): Promise<SimilarityResult[]> => {
      if (queryEmbedding.length !== embeddingDim) {
        throw new Error(
          `[useSQLiteRAG] Dimensión incorrecta: esperaba ${embeddingDim}, ` +
            `recibió ${queryEmbedding.length}.`,
        );
      }

      const db = requireDb();

      // Serializa el vector de consulta como Float32 BLOB.
      const embedding = toFloat32Buffer(queryEmbedding);

      // sqlite-vec: MATCH busca los k vecinos más cercanos y devuelve distance.
      const sql = `
        SELECT
          chunk_id,
          document_id,
          content,
          metadata,
          distance
        FROM ${embeddingTable}
        WHERE embedding MATCH (?)
          AND k = ?
        ORDER BY distance
      `;

      const { rows } = await db.execute(sql, [embedding, topK]);

      return (rows ?? [])
        .map(row => {
          let title = 'Fuente desconocida';
          try {
            const meta = JSON.parse((row.metadata as string) || '{}');
            title = meta.document_title || row.document_id || title;
          } catch {
            title = (row.document_id as string) || title;
          }
          return {
            title,
            content: (row.content as string) || '',
            similarity: 1 - (row.distance as number),
          };
        })
        .filter(r => r.similarity >= threshold);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [embeddingTable, embeddingDim],
  );

  // ── query genérico ──────────────────────────────────────────────────────────

  const query = useCallback(
    async <T = Record<string, unknown>>(
      sql: string,
      params: Scalar[] = [],
    ): Promise<QueryResult<T>> => {
      const db = requireDb();
      const result = await db.execute(sql, params);
      return {
        rows: (result.rows ?? []) as T[],
        rowsAffected: result.rowsAffected ?? 0,
        insertId: result.insertId,
      };
    },
    [],
  );

  // ─────────────────────────────────────────────────────────────────────────────

  return {
    loading,
    error,
    isReady,
    similaritySearch,
    query,
  };
}
