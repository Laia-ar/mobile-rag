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

        if (cancelled) return;

        // const filename = "knowledge.current/itsrag_2026-06-17_175741.db"
        const filename = "knowledge.current/corpus.sqlite"
        
        // const path = `knowledge.current/${file}`
        // const folder = `${RNFS.TemporaryDirectoryPath}/db`
        // const dest = `${folder}/${file}`
        // const present = await RNFS.exists(dest);
        // if (!present) {
          // console.log("copy DB to ", dest)
          // const exists = await RNFS.existsAssets(path);
          // if (!exists) throw new Error(`Archivo no encontdrado: ${path}`);
          // await RNFS.mkdir(folder)
          // await RNFS.copyFileAssets(path, dest)
        // }
  const moved = await moveAssetsDatabase({ filename , overwrite: true});
  if (!moved) {
    throw new Error(`Could not move assets database: ${filename}`);
  }

          console.log("db readyd")
          const db = open({ name: filename });
          // const db = open({ name: `corpus`, location: ":memory:" });
          console.log("db readyd")
          // db.loadExtension("vec0")
        // await db.execute('PRAGMA journal_mode = WAL;');
        // await db.execute('PRAGMA synchronous  = NORMAL;');
        // await db.execute('PRAGMA temp_store   = MEMORY;');
        // await db.execute('PRAGMA mmap_size    = 268435456;'); // 256 MB mmap
  await db.execute('BEGIN TRANSACTION');
          console.log("db readyd")
        await db.loadFile(dest)
          console.log("db readyd")
  await db.execute('COMMIT');
          console.log("db readyd")
        // await db.transaction(async tx => {
          console.log("db readyd")
        // })

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
      question: string,
      queryEmbedding: number[],
    ): Promise<SimilarityResult[]> => {
      if (queryEmbedding.length < embeddingDim) {
        throw new Error(
          `[useSQLiteRAG] Dimensión incorrecta: esperaba al menos ${embeddingDim}, ` +
          `recibió ${queryEmbedding.length}.`,
        );
      }

      const db = requireDb();

      // Serializa el vector de consulta como Float32 BLOB.
      // op-sqlite lo pasa directamente a SQLite sin conversión adicional.
      const embedding = toFloat32Buffer(queryEmbedding.length === embeddingDim ? queryEmbedding : matryoshka256(queryEmbedding));

      const query_str = transformQuestion(question)
      const k = 30
      const rrf_k = 60
      const weight_fts = 1.0
      const weight_vec = 1.0
      const threshold = 0.01
      const params = [embedding, k, query_str, k, rrf_k, weight_fts, rrf_k, weight_vec, threshold]
      const sql = `
        WITH vec_matches AS (
          SELECT
            c.id       AS chunk_id,
            v.distance AS score
          FROM chunks_vec AS v
          JOIN chunks     AS c on c.rowid = v.rowid
          WHERE
            v.embedding MATCH (?)
            AND v.k = ?
            AND v.corpus_id = '4a767b76-1cba-4568-b4d9-f649fd6ccf0c'
          ORDER BY v.distance
        ),
        fts_matches AS (
          SELECT
            chunk_id,
            text_for_display AS text,
            bm25(chunks_fts) AS score
          FROM chunks_fts
          WHERE chunks_fts MATCH (?)
            AND corpus_id = '4a767b76-1cba-4568-b4d9-f649fd6ccf0c'
          ORDER BY score
          LIMIT ?
        ),
        final AS (
          SELECT
            documents.title,
            chunks.content,
            fts_matches.text_for_display AS text,
            vec_matches.score            AS vec_rank,
            fts_matches.score            AS fts_rank,
            (
              coalesce(1.0 / (? + fts_matches.score), 0.0) * ? +
              coalesce(1.0 / (? + vec_matches.score), 0.0) * ?
            ) AS similarity
          FROM fts_matches
          FULL OUTER JOIN vec_matches ON vec_matches.chunk_id = fts_matches.chunk_id
          JOIN chunks ON chunks.id = coalesce(fts_matches.chunk_id, vec_matches.chunk_id)
          JOIN documents ON documents.id = chunks.document_id
          ORDER BY similarity DESC
        )
        SELECT * FROM final WHERE similarity > ? LIMIT 5;
      `;

      const { rows } = await db.execute(sql, params);

      return (rows ?? []).map(row => ({
        title: row.title as string,
        content: row.content as string,
        similarity: row.similarity as number,
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

function transformQuestion(str: string): string {
  return str
    .replaceAll(/["\*\(\)]/g, '')
    .replace(/  *$/, '"')
    .replace(/^  */, '"')
    .replaceAll(/  */g, '" OR "')
}

function matryoshka256(emb: number[]): number[] {
  const t = emb.slice(0, 256);
  const norm = Math.sqrt(t.reduce((s, x) => s + x * x, 0));
  return t.map(x => x / norm);
}
