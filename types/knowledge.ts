export type CountryCode = 'AR' | 'BO';

export type KnowledgePackageStatus =
  | 'loading'
  | 'ready'
  | 'missing'
  | 'error';

export interface KnowledgeFileDefinition {
  path: string;
  sha256?: string;
  sizeBytes?: number;
}

export interface KnowledgeManifest {
  schemaVersion: 1;
  packageVersion: string;
  countries: CountryCode[];
  corpus: {
    countryIds: Record<CountryCode, string>;
    databasePath: string;
    documentsDirectory: string;
  };
  embedding: {
    id: string;
    modelPath: string;
    dimensions: number;
    retrievalDimensions: number;
    queryPrefix?: string;
    normalize?: boolean;
  };
  llm: {
    id: string;
    modelPath: string;
    systemPromptPath?: string;
    contextParams?: Record<string, number | boolean | string>;
    completionParams?: Record<string, number | boolean | string | string[]>;
  };
  access:
    | {
        strategy: 'sha256-allowlist-v1';
        acceptedCodeHashes: Record<CountryCode, string[]>;
      }
    | {
        strategy: 'disabled-for-development';
      };
  files: KnowledgeFileDefinition[];
}

export interface InstalledKnowledgePackage {
  manifest: KnowledgeManifest;
  rootPath: string;
  resolvePath: (relativePath: string) => string;
}

export interface KnowledgeDocument {
  id: string;
  corpusId: string;
  title: string;
  description: string;
  institution: string;
  country?: CountryCode;
  publishedAt?: string;
  fileSize?: number;
  pageCount?: number;
  relativePath: string;
  absolutePath: string;
}

export interface SourceReference {
  id: string;
  chunkId: string;
  documentId: string;
  title: string;
  institution: string;
  content: string;
  similarity: number;
  page?: number;
  pageEnd?: number;
  sectionPath?: string[];
  relativePath: string;
  absolutePath: string;
}

export interface SavedSource extends SourceReference {
  savedAt: string;
}

export interface SavedGuide extends KnowledgeDocument {
  savedAt: string;
}
