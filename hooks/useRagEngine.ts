import {DB, Scalar, open} from '@op-engineering/op-sqlite';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  KnowledgePackageMissingError,
  installBundledKnowledgePackage,
} from '../services/knowledge/packageService';
import {
  CountryCode,
  InstalledKnowledgePackage,
  KnowledgeDocument,
  KnowledgePackageStatus,
  SourceReference,
} from '../types/knowledge';

export type SimilarityResult = SourceReference;

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowsAffected: number;
  insertId?: number;
}

export interface UseSQLiteRAGOptions {
  country?: CountryCode;
  defaultTopK?: number;
  /** @deprecated El nombre de la base ahora se obtiene de manifest.json. */
  assetDbName?: string;
  /** @deprecated La dimensión ahora se obtiene de manifest.json. */
  embeddingDim?: number;
  /** @deprecated La tabla forma parte del contrato del paquete offline. */
  embeddingTable?: string;
}

export interface UseSQLiteRAGReturn {
  loading: boolean;
  error: Error | null;
  isReady: boolean;
  status: KnowledgePackageStatus;
  installedPackage: InstalledKnowledgePackage | null;
  documents: KnowledgeDocument[];
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
  refresh: () => void;
}

type DatabaseRow = Record<string, Scalar>;

function fileName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function directoryName(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.slice(0, normalized.lastIndexOf('/'));
}

function toFloat32Buffer(values: number[]): ArrayBuffer {
  const output = new Float32Array(values.length);
  output.set(values);
  return output.buffer;
}

function truncateAndNormalize(values: number[], dimensions: number): number[] {
  if (values.length < dimensions) {
    throw new Error(
      `El embedding tiene ${values.length} dimensiones y la base requiere ${dimensions}.`,
    );
  }
  const truncated = values.slice(0, dimensions);
  const norm = Math.sqrt(truncated.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(norm) || norm === 0) {
    throw new Error('El modelo devolvió un embedding inválido.');
  }
  return truncated.map(value => value / norm);
}

function transformQuestion(question: string): string {
  const words = question
    .normalize('NFKC')
    .replace(/["*()']/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 1)
    .slice(0, 24);
  return words.length > 0
    ? words.map(word => `"${word.replace(/"/g, '')}"`).join(' OR ')
    : '"consulta"';
}

function countryFromDatabase(value: unknown): CountryCode | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'ar' || normalized === 'argentina') return 'AR';
  if (normalized === 'bo' || normalized === 'bolivia') return 'BO';
  return undefined;
}

function corpusIdForCountry(
  knowledgePackage: InstalledKnowledgePackage,
  country?: CountryCode,
): string {
  const selectedCountry = country ?? knowledgePackage.manifest.countries[0];
  const corpusId = knowledgePackage.manifest.corpus.countryIds[selectedCountry];
  if (!corpusId) {
    throw new Error(`El paquete offline no declara un corpus para ${selectedCountry}.`);
  }
  return corpusId;
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseSectionPath(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || value === '') return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter(item => typeof item === 'string')
      : undefined;
  } catch {
    return value.split('>').map(item => item.trim()).filter(Boolean);
  }
}

function safeDocumentPath(
  rawPath: unknown,
  documentId: string,
  documentsDirectory: string,
): string {
  const normalized = stringValue(rawPath).replace(/\\/g, '/');
  if (
    normalized &&
    !normalized.startsWith('/') &&
    !/^[a-zA-Z]:\//.test(normalized) &&
    !normalized.split('/').includes('..')
  ) {
    return normalized.includes('/')
      ? normalized
      : `${documentsDirectory}/${normalized}`;
  }
  const originalName = normalized.slice(normalized.lastIndexOf('/') + 1);
  return `${documentsDirectory}/${originalName || `${documentId}.pdf`}`;
}

function columnExpression(
  columns: Set<string>,
  tableAlias: string,
  column: string,
  fallbackSql: string,
): string {
  return columns.has(column)
    ? `${tableAlias}.${column} AS ${column}`
    : `${fallbackSql} AS ${column}`;
}

async function tableColumns(db: DB, table: string): Promise<Set<string>> {
  const result = await db.execute(`PRAGMA table_info(${table});`);
  return new Set(
    (result.rows ?? [])
      .map(row => row.name)
      .filter((name): name is string => typeof name === 'string'),
  );
}

function documentFromRow(
  row: DatabaseRow,
  knowledgePackage: InstalledKnowledgePackage,
  selectedCountry?: CountryCode,
): KnowledgeDocument {
  const id = stringValue(row.id);
  const relativePath = safeDocumentPath(
    row.pdf_path ?? row.file_path,
    id,
    knowledgePackage.manifest.corpus.documentsDirectory,
  );
  return {
    id,
    corpusId: stringValue(row.corpus_id),
    title: stringValue(row.title, 'Documento sin título'),
    description: stringValue(row.description),
    institution: stringValue(row.institution),
    country: selectedCountry ?? countryFromDatabase(row.country),
    publishedAt: stringValue(row.doc_date) || undefined,
    fileSize: numberValue(row.file_size),
    pageCount: numberValue(row.page_count),
    relativePath,
    absolutePath: knowledgePackage.resolvePath(relativePath),
  };
}

export function useSQLiteRAG(
  options: UseSQLiteRAGOptions = {},
): UseSQLiteRAGReturn {
  const {country, defaultTopK = 1} = options;
  const dbRef = useRef<DB | null>(null);
  const packageRef = useRef<InstalledKnowledgePackage | null>(null);
  const documentColumnsRef = useRef<Set<string>>(new Set());
  const chunkColumnsRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<KnowledgePackageStatus>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [installedPackage, setInstalledPackage] =
    useState<InstalledKnowledgePackage | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setStatus('loading');
      setError(null);
      setDocuments([]);
      try {
        const knowledgePackage = await installBundledKnowledgePackage();
        const corpusId = corpusIdForCountry(knowledgePackage, country);
        const databasePath = knowledgePackage.resolvePath(
          knowledgePackage.manifest.corpus.databasePath,
        );
        const db = open({
          name: fileName(databasePath),
          location: directoryName(databasePath),
        });
        await db.execute('PRAGMA query_only = true;');
        await db.execute('PRAGMA foreign_keys = true;');
        await db.execute('PRAGMA temp_store = MEMORY;');
        const integrityResult = await db.execute('PRAGMA integrity_check;');
        const integrityValue = integrityResult.rows?.[0]
          ? Object.values(integrityResult.rows[0])[0]
          : undefined;
        if (integrityValue !== 'ok') {
          db.close();
          throw new Error('La base offline no superó PRAGMA integrity_check.');
        }

        const tablesResult = await db.execute(
          "SELECT name FROM sqlite_master WHERE type IN ('table', 'view');",
        );
        const availableTables = new Set(
          (tablesResult.rows ?? [])
            .map(row => row.name)
            .filter((name): name is string => typeof name === 'string'),
        );
        const missingTables = ['documents', 'chunks', 'chunks_vec', 'chunks_fts']
          .filter(table => !availableTables.has(table));
        if (missingTables.length > 0) {
          db.close();
          throw new Error(
            `La base offline no cumple el schema requerido: ${missingTables.join(', ')}.`,
          );
        }

        const documentColumns = await tableColumns(db, 'documents');
        const chunkColumns = await tableColumns(db, 'chunks');
        const documentSelect = [
          'd.id',
          'd.corpus_id',
          'd.title',
          columnExpression(documentColumns, 'd', 'description', "''"),
          columnExpression(documentColumns, 'd', 'institution', "''"),
          columnExpression(documentColumns, 'd', 'country', 'NULL'),
          columnExpression(documentColumns, 'd', 'doc_date', 'NULL'),
          columnExpression(documentColumns, 'd', 'file_size', 'NULL'),
          columnExpression(documentColumns, 'd', 'page_count', 'NULL'),
          columnExpression(documentColumns, 'd', 'file_path', 'NULL'),
          columnExpression(documentColumns, 'd', 'pdf_path', 'NULL'),
        ].join(', ');
        const result = await db.execute(
          `SELECT ${documentSelect} FROM documents d WHERE d.corpus_id = ? ORDER BY d.title COLLATE NOCASE;`,
          [corpusId],
        );
        const loadedDocuments = (result.rows ?? [])
          .map(row => documentFromRow(row, knowledgePackage, country))
          .filter(document => document.relativePath.toLowerCase().endsWith('.pdf'));

        if (cancelled) {
          await db.close();
          return;
        }
        dbRef.current = db;
        packageRef.current = knowledgePackage;
        documentColumnsRef.current = documentColumns;
        chunkColumnsRef.current = chunkColumns;
        setInstalledPackage(knowledgePackage);
        setDocuments(loadedDocuments);
        setStatus('ready');
      } catch (cause) {
        if (cancelled) return;
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setInstalledPackage(null);
        setError(nextError);
        setStatus(
          nextError instanceof KnowledgePackageMissingError ? 'missing' : 'error',
        );
      }
    };

    initialize().catch(() => undefined);
    return () => {
      cancelled = true;
      const db = dbRef.current;
      dbRef.current = null;
      packageRef.current = null;
      if (db) db.close();
    };
  }, [country, refreshVersion]);

  const requireRuntime = useCallback(() => {
    if (!dbRef.current || !packageRef.current) {
      throw new Error('El paquete de conocimiento todavía no está listo.');
    }
    return {db: dbRef.current, knowledgePackage: packageRef.current};
  }, []);

  const similaritySearch = useCallback(
    async (
      question: string,
      queryEmbedding: number[],
      topK = defaultTopK,
      threshold = 0,
    ): Promise<SimilarityResult[]> => {
      const {db, knowledgePackage} = requireRuntime();
      const {manifest} = knowledgePackage;
      const corpusId = corpusIdForCountry(knowledgePackage, country);
      const normalizedEmbedding = truncateAndNormalize(
        queryEmbedding,
        manifest.embedding.retrievalDimensions,
      );
      const embedding = toFloat32Buffer(normalizedEmbedding);
      const candidateCount = Math.max(topK * 6, 30);
      const rrfConstant = 60;
      const documentColumns = documentColumnsRef.current;
      const chunkColumns = chunkColumnsRef.current;
      const selectMetadata = [
        columnExpression(documentColumns, 'd', 'institution', "''"),
        columnExpression(documentColumns, 'd', 'file_path', 'NULL'),
        columnExpression(documentColumns, 'd', 'pdf_path', 'NULL'),
        columnExpression(chunkColumns, 'c', 'page', 'NULL'),
        columnExpression(chunkColumns, 'c', 'page_range', 'NULL'),
        columnExpression(chunkColumns, 'c', 'section_path', 'NULL'),
      ].join(', ');
      const sql = `
        WITH vec_matches AS (
          SELECT c.id AS chunk_id,
                 ROW_NUMBER() OVER (ORDER BY v.distance) AS rank
          FROM chunks_vec v
          JOIN chunks c ON c.rowid = v.rowid
          WHERE v.embedding MATCH ? AND v.k = ? AND v.corpus_id = ?
        ),
        fts_matches AS (
          SELECT chunk_id,
                 ROW_NUMBER() OVER (ORDER BY bm25(chunks_fts)) AS rank
          FROM chunks_fts
          WHERE chunks_fts MATCH ? AND corpus_id = ?
          ORDER BY bm25(chunks_fts)
          LIMIT ?
        ),
        ranked AS (
          SELECT chunk_id, 1.0 / (? + rank) AS score FROM vec_matches
          UNION ALL
          SELECT chunk_id, 1.0 / (? + rank) AS score FROM fts_matches
        ),
        scores AS (
          SELECT chunk_id, SUM(score) AS similarity
          FROM ranked
          GROUP BY chunk_id
        )
        SELECT c.id AS chunk_id, c.document_id, c.content, d.title,
               scores.similarity, ${selectMetadata}
        FROM scores
        JOIN chunks c ON c.id = scores.chunk_id
        JOIN documents d ON d.id = c.document_id
        WHERE scores.similarity >= ?
        ORDER BY scores.similarity DESC
        LIMIT ?;
      `;
      const result = await db.execute(sql, [
        embedding,
        candidateCount,
        corpusId,
        transformQuestion(question),
        corpusId,
        candidateCount,
        rrfConstant,
        rrfConstant,
        threshold,
        topK,
      ]);

      return (result.rows ?? []).map((row, index) => {
        const documentId = stringValue(row.document_id);
        const relativePath = safeDocumentPath(
          row.pdf_path ?? row.file_path,
          documentId,
          manifest.corpus.documentsDirectory,
        );
        const pageRange = stringValue(row.page_range);
        const pageNumbers = pageRange
          .split(/[-–]/)
          .map(value => Number.parseInt(value.trim(), 10))
          .filter(Number.isFinite);
        return {
          id: `${stringValue(row.chunk_id)}-${index}`,
          chunkId: stringValue(row.chunk_id),
          documentId,
          title: stringValue(row.title, 'Documento sin título'),
          institution: stringValue(row.institution),
          content: stringValue(row.content),
          similarity: Number(row.similarity ?? 0),
          page: numberValue(row.page) ?? pageNumbers[0],
          pageEnd: pageNumbers[1],
          sectionPath: parseSectionPath(row.section_path),
          relativePath,
          absolutePath: knowledgePackage.resolvePath(relativePath),
        };
      });
    },
    [country, defaultTopK, requireRuntime],
  );

  const query = useCallback(
    async <T = Record<string, unknown>>(
      sql: string,
      params: Scalar[] = [],
    ): Promise<QueryResult<T>> => {
      const {db} = requireRuntime();
      const result = await db.execute(sql, params);
      return {
        rows: (result.rows ?? []) as T[],
        rowsAffected: result.rowsAffected ?? 0,
        insertId: result.insertId,
      };
    },
    [requireRuntime],
  );

  return {
    loading: status === 'loading',
    error,
    isReady: status === 'ready',
    status,
    installedPackage,
    documents,
    similaritySearch,
    query,
    refresh: () => setRefreshVersion(value => value + 1),
  };
}
