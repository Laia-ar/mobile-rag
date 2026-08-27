import {parseKnowledgeManifest} from '../services/knowledge/manifest';

const sha256 = 'a'.repeat(64);

function validManifest() {
  return {
    schemaVersion: 1,
    packageVersion: 'test-1',
    countries: ['AR', 'BO'],
    corpus: {
      countryIds: {AR: 'corpus-ar', BO: 'corpus-bo'},
      databasePath: 'database/corpus.sqlite',
      documentsDirectory: 'documents',
    },
    embedding: {
      id: 'embedding-test',
      modelPath: 'models/embedding.gguf',
      dimensions: 768,
      retrievalDimensions: 256,
    },
    llm: {
      id: 'chat-test',
      modelPath: 'models/chat.gguf',
      systemPromptPath: 'prompts/system.txt',
    },
    access: {
      strategy: 'sha256-allowlist-v1',
      acceptedCodeHashes: {AR: [sha256], BO: [sha256]},
    },
    files: [
      {path: 'database/corpus.sqlite', sha256},
      {path: 'models/embedding.gguf', sha256},
      {path: 'models/chat.gguf', sha256},
      {path: 'prompts/system.txt', sha256},
      {path: 'documents/guide.pdf', sha256},
    ],
  };
}

describe('parseKnowledgeManifest', () => {
  it('acepta un paquete v1 completo', () => {
    const manifest = parseKnowledgeManifest(JSON.stringify(validManifest()));
    expect(manifest.corpus.countryIds.AR).toBe('corpus-ar');
    expect(manifest.embedding.retrievalDimensions).toBe(256);
  });

  it('rechaza rutas que escapan del paquete', () => {
    const manifest = validManifest();
    manifest.files[0].path = '../corpus.sqlite';
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'Ruta no permitida',
    );
  });

  it('rechaza un modelo requerido que no está declarado en files', () => {
    const manifest = validManifest();
    manifest.files = manifest.files.filter(file => file.path !== 'models/chat.gguf');
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'archivo requerido',
    );
  });

  it('rechaza dimensiones de retrieval mayores al embedding', () => {
    const manifest = validManifest();
    manifest.embedding.retrievalDimensions = 1024;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'retrievalDimensions',
    );
  });

  it('acepta acceso deshabilitado solo para desarrollo', () => {
    const manifest = validManifest();
    manifest.access = {strategy: 'disabled-for-development'} as typeof manifest.access;
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.access.strategy).toBe('disabled-for-development');
  });

  it('requiere un corpus para cada pais incluido', () => {
    const manifest = validManifest();
    delete (manifest.corpus.countryIds as Partial<Record<'AR' | 'BO', string>>).BO;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'corpus.countryIds.BO',
    );
  });
});
