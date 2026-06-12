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
 *   CREATE TABLE embeddings (
 *     id        INTEGER  PRIMARY KEY,
 *     content   TEXT     NOT NULL,
 *     embedding BLOB     NOT NULL,   -- vec_f32(dim) — Float32 little-endian
 *     metadata  TEXT                 -- JSON opcional
 *   );
 *
 *   -- Índice virtual de sqlite-vec para búsqueda vectorial eficiente (opcional)
 *   CREATE VIRTUAL TABLE vec_index USING vec0(embedding float[1536]);
 *
 * ─── Similitud coseno ─────────────────────────────────────────────────────────
 *   sqlite-vec expone la función SQL  vec_distance_cosine(a, b)  que corre
 *   completamente en C++ en el hilo nativo de op-sqlite. No hay cómputo
 *   vectorial en el hilo de JavaScript.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  open,
  moveAssetsDatabase,
  DB,
  Scalar,
} from '@op-engineering/op-sqlite';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface SimilarityResult {
  id: number;
  document: string;
  content: string;
  /** Similitud coseno en [0, 1]: 1 = idéntico, 0 = ortogonal */
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
   * Nombre de la tabla que contiene los embeddings.
   * @default "embeddings"
   */
  embeddingTable?: string;

  /**
   * Dimensión de los vectores de embeddings (debe coincidir con el BLOB).
   * @default 1536
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

  /**
   * Búsqueda por similitud coseno.
   *
   * Usa vec_distance_cosine() de sqlite-vec: el cómputo corre íntegramente
   * en C++ sobre el hilo dedicado de op-sqlite, sin bloquear el hilo JS.
   *
   * @param queryEmbedding  Vector de consulta (Float32, misma dimensión que los docs)
   * @param topK            Máximo de resultados a devolver (default: 5)
   * @param threshold       Similitud mínima en [0,1] (default: 0.7)
   */
  similaritySearch: (
    queryEmbedding: number[],
    topK?: number,
    threshold?: number,
  ) => Promise<SimilarityResult[]>;

  /**
   * Ejecuta un SELECT arbitrario sobre la DB.
   * Útil para consultar otras tablas que pueda tener el .sqlite.
   */
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

// ─── Hook principal ────────────────────────────────────────────────────────────

export function useSQLiteRAG(
  options: UseSQLiteRAGOptions = {},
): UseSQLiteRAGReturn {
  const {
    assetDbName = 'rag_database.sqlite',
    embeddingTable = 'embeddings',
    embeddingDim = 1536,
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

        // moveAssetsDatabase es idempotente:
        //   · Primera vez: copia assets/<assetDbName> al directorio por defecto
        //   · Siguientes arranques: detecta que ya existe y no hace nada
        // Devuelve false si no pudo copiar (e.g. el archivo no está en assets).
        const moved = await moveAssetsDatabase({ filename: assetDbName });
        if (!moved) {
          throw new Error(
            `[useSQLiteRAG] No se pudo copiar "${assetDbName}" desde los assets.\n` +
              `Verificá que el archivo esté en assets/ y que hayas ejecutado:\n` +
              `  npx react-native-asset@latest`,
          );
        }

        if (cancelled) return;

        // Abre la DB — op-sqlite usa el directorio por defecto de la plataforma
        // (iOS Library/, Android databases/) al no pasar location.
        const db = open({ name: assetDbName });

        // ── Pragmas de rendimiento (workload de solo lectura) ─────────────────
        await db.execute('PRAGMA journal_mode = WAL;');
        await db.execute('PRAGMA synchronous  = NORMAL;');
        await db.execute('PRAGMA temp_store   = MEMORY;');
        await db.execute('PRAGMA mmap_size    = 268435456;'); // 256 MB mmap

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
          console.error('[useSQLiteRAG] init error:', e);
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
      queryEmbedding: number[],
      topK = 5,
      threshold = 0.7,
    ): Promise<SimilarityResult[]> => {
      if (queryEmbedding.length !== embeddingDim) {
        throw new Error(
          `[useSQLiteRAG] Dimensión incorrecta: esperaba ${embeddingDim}, ` +
            `recibió ${queryEmbedding.length}.`,
        );
      }

      const db = requireDb();

      // Serializa el vector de consulta como Float32 BLOB.
      // op-sqlite lo pasa directamente a SQLite sin conversión adicional.
      const queryBlob = toFloat32Buffer(queryEmbedding);

      // const sql = `
      //   SELECT
      //     id,
      //     content,
      //     metadata,
      //     (1.0 - vec_distance_cosine(embedding, ?) / 2.0) AS similarity
      //   FROM  ${embeddingTable}
      //   WHERE similarity >= ?
      //   ORDER BY similarity DESC
      //   LIMIT ?
      // `;
      // const { rows } = await db.execute(sql, [queryBlob, threshold, topK]);

      const sql = `SELECT chunk_id, distance, document_id, content FROM vec_chunks WHERE embedding match ? ORDER BY distance LIMIT 3;`;

      const { rows } = await db.execute(sql, [queryBlob]);

      return (rows ?? []).map(row => ({
        id: row.id as number,
        content: row.content as string,
        similarity: row.similarity as number,
        document: row.document as string,
      }));
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
