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

  it('acepta un LLM remoto OpenRouter sin modelPath', () => {
    const manifest = validManifest();
    (manifest.llm as Record<string, unknown>).provider = 'openrouter';
    (manifest.llm as Record<string, unknown>).remoteModelId =
      'anthropic/claude-sonnet-5';
    (manifest.llm as Record<string, unknown>).apiKey = 'sk-or-test';
    delete (manifest.llm as Record<string, unknown>).modelPath;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.provider).toBe('openrouter');
    expect(parsed.llm.remoteModelId).toBe('anthropic/claude-sonnet-5');
    expect(parsed.llm.modelPath).toBeUndefined();
  });

  it('exige remoteModelId con provider openrouter', () => {
    const manifest = validManifest();
    (manifest.llm as Record<string, unknown>).provider = 'openrouter';
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteModelId',
    );
  });

  it('acepta un LLM remoto sin apiKey (se configura en Ajustes)', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.provider).toBe('openrouter');
    expect(parsed.llm.apiKey).toBeUndefined();
  });

  it('rechaza una apiKey vacía si viene declarada', () => {
    const manifest = validManifest();
    (manifest.llm as Record<string, unknown>).provider = 'openrouter';
    (manifest.llm as Record<string, unknown>).remoteModelId = 'x-ai/grok-4.20';
    (manifest.llm as Record<string, unknown>).apiKey = '  ';
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.apiKey',
    );
  });

  it('propaga llm.baseUrl cuando viene declarada (servidor propio)', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'server-test',
      provider: 'openrouter',
      remoteModelId: 'gemma-4-e2b-q4km',
      baseUrl: 'http://64.176.6.198:8002/v1',
      apiKey: 'key-de-prueba',
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.baseUrl).toBe('http://64.176.6.198:8002/v1');
  });

  it('deja llm.baseUrl undefined cuando no viene (default OpenRouter)', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.baseUrl).toBeUndefined();
  });

  it('exige modelPath cuando el provider es local', () => {
    const manifest = validManifest();
    delete (manifest.llm as Record<string, unknown>).modelPath;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.modelPath',
    );
  });

  it('propaga llm.remoteOptions con baseUrl propio por opción', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'server-test',
      provider: 'openrouter',
      remoteModelId: 'gemma-4-e2b-q4km',
      baseUrl: 'http://64.176.6.198:8002/v1',
      remoteOptions: [
        {
          id: 'Gemma 4 E2B',
          remoteModelId: 'gemma-4-e2b-q4km',
          baseUrl: 'http://64.176.6.198:8002/v1',
        },
        {
          id: 'Qwen 3.5 4B',
          remoteModelId: 'qwen3.5-4b-q4km',
          baseUrl: 'http://64.176.6.198:8001/v1',
        },
      ],
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.remoteOptions).toHaveLength(2);
    expect(parsed.llm.remoteOptions?.[0]).toEqual({
      id: 'Gemma 4 E2B',
      remoteModelId: 'gemma-4-e2b-q4km',
      baseUrl: 'http://64.176.6.198:8002/v1',
    });
    expect(parsed.llm.remoteOptions?.[1].baseUrl).toBe(
      'http://64.176.6.198:8001/v1',
    );
  });

  it('acepta remoteOptions sin baseUrl (hereda llm.baseUrl)', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
      remoteOptions: [{id: 'Grok', remoteModelId: 'x-ai/grok-4.20'}],
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.remoteOptions?.[0].baseUrl).toBeUndefined();
  });

  it('propaga extraBody por opción (p.ej. chat_template_kwargs de llama.cpp)', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'server-test',
      provider: 'openrouter',
      remoteModelId: 'gemma-4-e2b-q4km',
      baseUrl: 'http://64.176.6.198:8002/v1',
      remoteOptions: [
        {id: 'Gemma 4 E2B', remoteModelId: 'gemma-4-e2b-q4km'},
        {
          id: 'Qwen 3.5 4B',
          remoteModelId: 'qwen3.5-4b-q4km',
          baseUrl: 'http://64.176.6.198:8001/v1',
          extraBody: {chat_template_kwargs: {enable_thinking: false}},
        },
      ],
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.remoteOptions?.[0].extraBody).toBeUndefined();
    expect(parsed.llm.remoteOptions?.[1].extraBody).toEqual({
      chat_template_kwargs: {enable_thinking: false},
    });
  });

  it('rechaza extraBody que no es un objeto', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'server-test',
      provider: 'openrouter',
      remoteModelId: 'qwen3.5-4b-q4km',
      remoteOptions: [
        {
          id: 'Qwen 3.5 4B',
          remoteModelId: 'qwen3.5-4b-q4km',
          extraBody: 'enable_thinking=false',
        },
      ],
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteOptions[0].extraBody',
    );
  });

  it('deja llm.remoteOptions undefined cuando no viene declarado', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
    } as unknown as typeof manifest.llm;
    manifest.files = manifest.files.filter(
      file => file.path !== 'models/chat.gguf',
    );
    const parsed = parseKnowledgeManifest(JSON.stringify(manifest));
    expect(parsed.llm.remoteOptions).toBeUndefined();
  });

  it('rechaza remoteOptions vacío', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
      remoteOptions: [],
    } as unknown as typeof manifest.llm;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteOptions',
    );
  });

  it('rechaza una opción remota sin id', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
      remoteOptions: [{remoteModelId: 'x-ai/grok-4.20'}],
    } as unknown as typeof manifest.llm;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteOptions[0].id',
    );
  });

  it('rechaza una opción remota sin remoteModelId', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
      remoteOptions: [{id: 'Grok'}],
    } as unknown as typeof manifest.llm;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteOptions[0].remoteModelId',
    );
  });

  it('rechaza remoteOptions duplicadas por id', () => {
    const manifest = validManifest();
    manifest.llm = {
      id: 'remote-test',
      provider: 'openrouter',
      remoteModelId: 'x-ai/grok-4.20',
      remoteOptions: [
        {id: 'Grok', remoteModelId: 'x-ai/grok-4.20'},
        {id: 'Grok', remoteModelId: 'x-ai/grok-4.20'},
      ],
    } as unknown as typeof manifest.llm;
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'duplicada',
    );
  });

  it('rechaza remoteOptions con provider local', () => {
    const manifest = validManifest();
    (manifest.llm as Record<string, unknown>).remoteOptions = [
      {id: 'Local', remoteModelId: 'local-model'},
    ];
    expect(() => parseKnowledgeManifest(JSON.stringify(manifest))).toThrow(
      'llm.remoteOptions',
    );
  });
});
