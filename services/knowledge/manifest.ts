import {
  CountryCode,
  KnowledgeFileDefinition,
  KnowledgeManifest,
} from '../../types/knowledge';

const COUNTRY_CODES: CountryCode[] = ['AR', 'BO'];
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const PACKAGE_VERSION_PATTERN = /^[a-zA-Z0-9._-]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`El campo ${field} debe ser un objeto.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`El campo ${field} debe ser un texto no vacío.`);
  }
  return value;
}

function requirePositiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`El campo ${field} debe ser un entero positivo.`);
  }
  return Number(value);
}

export function assertSafeRelativePath(path: string): void {
  const normalized = path.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.split('/').some(part => part === '..' || part === '')
  ) {
    throw new Error(`Ruta no permitida en el manifiesto: ${path}`);
  }
}

function parseCountries(value: unknown): CountryCode[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('countries debe contener AR y/o BO.');
  }
  const countries = value.map(item => requireString(item, 'countries[]'));
  if (countries.some(item => !COUNTRY_CODES.includes(item as CountryCode))) {
    throw new Error('countries solo acepta AR y BO.');
  }
  return Array.from(new Set(countries)) as CountryCode[];
}

function parseHashes(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} debe ser una lista.`);
  }
  return value.map((hash, index) => {
    const parsed = requireString(hash, `${field}[${index}]`).toLowerCase();
    if (!SHA256_PATTERN.test(parsed)) {
      throw new Error(`${field}[${index}] no es un SHA-256 válido.`);
    }
    return parsed;
  });
}

function parseFiles(value: unknown): KnowledgeFileDefinition[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('files debe declarar todos los archivos del paquete.');
  }
  const paths = new Set<string>();
  return value.map((item, index) => {
    const file = requireRecord(item, `files[${index}]`);
    const path = requireString(file.path, `files[${index}].path`);
    assertSafeRelativePath(path);
    if (paths.has(path)) {
      throw new Error(`Ruta duplicada en files: ${path}`);
    }
    paths.add(path);

    const parsed: KnowledgeFileDefinition = {path};
    const sha256 = requireString(file.sha256, `files[${index}].sha256`);
    if (!SHA256_PATTERN.test(sha256)) {
      throw new Error(`files[${index}].sha256 no es válido.`);
    }
    parsed.sha256 = sha256.toLowerCase();
    if (file.sizeBytes !== undefined) {
      parsed.sizeBytes = requirePositiveInteger(
        file.sizeBytes,
        `files[${index}].sizeBytes`,
      );
    }
    return parsed;
  });
}

export function parseKnowledgeManifest(raw: string): KnowledgeManifest {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('manifest.json no contiene JSON válido.');
  }

  const root = requireRecord(value, 'manifest');
  if (root.schemaVersion !== 1) {
    throw new Error(`schemaVersion no soportado: ${String(root.schemaVersion)}`);
  }

  const corpus = requireRecord(root.corpus, 'corpus');
  const countries = parseCountries(root.countries);
  const countryIds = requireRecord(corpus.countryIds, 'corpus.countryIds');
  const embedding = requireRecord(root.embedding, 'embedding');
  const llm = requireRecord(root.llm, 'llm');
  const access = requireRecord(root.access, 'access');

  if (
    access.strategy !== 'sha256-allowlist-v1' &&
    access.strategy !== 'disabled-for-development'
  ) {
    throw new Error('La estrategia de acceso no está soportada.');
  }

  const databasePath = requireString(corpus.databasePath, 'corpus.databasePath');
  const documentsDirectory = requireString(
    corpus.documentsDirectory,
    'corpus.documentsDirectory',
  );
  const embeddingModelPath = requireString(
    embedding.modelPath,
    'embedding.modelPath',
  );
  const llmModelPath = requireString(llm.modelPath, 'llm.modelPath');

  [databasePath, documentsDirectory, embeddingModelPath, llmModelPath].forEach(
    assertSafeRelativePath,
  );
  if (llm.systemPromptPath !== undefined) {
    assertSafeRelativePath(
      requireString(llm.systemPromptPath, 'llm.systemPromptPath'),
    );
  }

  const files = parseFiles(root.files);
  const declaredFiles = new Set(files.map(file => file.path));
  const requiredFiles = [databasePath, embeddingModelPath, llmModelPath];
  if (llm.systemPromptPath) {
    requiredFiles.push(llm.systemPromptPath as string);
  }
  requiredFiles.forEach(path => {
    if (!declaredFiles.has(path)) {
      throw new Error(`El archivo requerido no está declarado en files: ${path}`);
    }
  });

  const dimensions = requirePositiveInteger(
    embedding.dimensions,
    'embedding.dimensions',
  );
  const retrievalDimensions = requirePositiveInteger(
    embedding.retrievalDimensions,
    'embedding.retrievalDimensions',
  );
  if (retrievalDimensions > dimensions) {
    throw new Error('retrievalDimensions no puede superar dimensions.');
  }

  const packageVersion = requireString(root.packageVersion, 'packageVersion');
  if (!PACKAGE_VERSION_PATTERN.test(packageVersion)) {
    throw new Error('packageVersion solo admite letras, números, punto, guion y guion bajo.');
  }

  const parsedCountryIds = Object.fromEntries(
    countries.map(country => [
      country,
      requireString(countryIds[country], `corpus.countryIds.${country}`),
    ]),
  ) as Record<CountryCode, string>;

  let parsedAccess: KnowledgeManifest['access'];
  if (access.strategy === 'disabled-for-development') {
    parsedAccess = {strategy: 'disabled-for-development'};
  } else {
    const acceptedCodeHashes = requireRecord(
      access.acceptedCodeHashes,
      'access.acceptedCodeHashes',
    );
    parsedAccess = {
      strategy: 'sha256-allowlist-v1',
      acceptedCodeHashes: {
        AR: parseHashes(acceptedCodeHashes.AR, 'access.acceptedCodeHashes.AR'),
        BO: parseHashes(acceptedCodeHashes.BO, 'access.acceptedCodeHashes.BO'),
      },
    };
  }

  return {
    schemaVersion: 1,
    packageVersion,
    countries,
    corpus: {
      countryIds: parsedCountryIds,
      databasePath,
      documentsDirectory,
    },
    embedding: {
      id: requireString(embedding.id, 'embedding.id'),
      modelPath: embeddingModelPath,
      dimensions,
      retrievalDimensions,
      queryPrefix:
        typeof embedding.queryPrefix === 'string'
          ? embedding.queryPrefix
          : undefined,
      normalize:
        typeof embedding.normalize === 'boolean'
          ? embedding.normalize
          : undefined,
    },
    llm: {
      id: requireString(llm.id, 'llm.id'),
      modelPath: llmModelPath,
      systemPromptPath:
        typeof llm.systemPromptPath === 'string'
          ? llm.systemPromptPath
          : undefined,
      contextParams: isRecord(llm.contextParams)
        ? (llm.contextParams as KnowledgeManifest['llm']['contextParams'])
        : undefined,
      completionParams: isRecord(llm.completionParams)
        ? (llm.completionParams as KnowledgeManifest['llm']['completionParams'])
        : undefined,
    },
    access: parsedAccess,
    files,
  };
}
