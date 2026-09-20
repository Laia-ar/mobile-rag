import {CompletionParams, ContextParams} from 'llama.rn';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import RNFS from 'react-native-fs';
import {buildRemoteMessages, ChatLine, useLlamaEngine} from './useLlamaEngine';
import {UseSQLiteRAGReturn} from './useRagEngine';
import {getStoredOpenRouterApiKey} from '../services/remote/apiKeyStorage';
import {
  generateRemoteCompletion,
  OpenRouterKeyInvalidError,
} from '../services/remote/openRouter';
import {SourceReference} from '../types/knowledge';

export type OfflineChatStatus =
  | 'unavailable'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export interface OfflineChatAnswer {
  id: string;
  question: string;
  text: string;
  sources: SourceReference[];
  createdAt: string;
}

export class MissingOpenRouterApiKeyError extends Error {
  constructor() {
    super(
      'Configurá tu API key de OpenRouter en Ajustes para usar el chat en la nube.',
    );
    this.name = 'MissingOpenRouterApiKeyError';
  }
}

const EMBEDDING_CONTEXT_PARAMS: Partial<ContextParams> = {embedding: true};
const EMPTY_COMPLETION_PARAMS: Partial<CompletionParams> = {};

function numericCompletionParam(
  params: Record<string, number | boolean | string | string[]> | undefined,
  key: string,
): number | undefined {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export function useOfflineChat(rag: UseSQLiteRAGReturn) {
  const manifest = rag.installedPackage?.manifest;
  const isRemote = manifest?.llm.provider === 'openrouter';
  const chatContextParams = useMemo(
    () => (manifest?.llm.contextParams ?? {}) as Partial<ContextParams>,
    [manifest],
  );
  const chatCompletionParams = useMemo(
    () => (manifest?.llm.completionParams ?? {}) as Partial<CompletionParams>,
    [manifest],
  );
  const chatEngine = useLlamaEngine({
    contextParams: chatContextParams,
    completionParams: chatCompletionParams,
  });
  const embeddingEngine = useLlamaEngine({
    contextParams: EMBEDDING_CONTEXT_PARAMS,
    completionParams: EMPTY_COMPLETION_PARAMS,
  });
  const loadChatModel = chatEngine.loadModel;
  const warmupChat = chatEngine.warmup;
  const generate = chatEngine.generate;
  const stopGeneration = chatEngine.stopGeneration;
  const loadEmbeddingModel = embeddingEngine.loadModel;
  const vectorize = embeddingEngine.vectorize;
  const similaritySearch = rag.similaritySearch;
  const [status, setStatus] = useState<OfflineChatStatus>('unavailable');
  const [error, setError] = useState<Error | null>(null);
  const [answer, setAnswer] = useState<OfflineChatAnswer | null>(null);
  // null = todavía no se verificó; en modo local siempre es true.
  const [hasRemoteApiKey, setHasRemoteApiKey] = useState<boolean | null>(null);
  const promptRef = useRef<string | undefined>(undefined);
  const historyRef = useRef<ChatLine[]>([]);
  const remoteAbortRef = useRef<AbortController | null>(null);
  const initializedVersionRef = useRef<string | null>(null);
  const initializingVersionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const knowledgePackage = rag.installedPackage;
    if (!knowledgePackage || rag.status !== 'ready') {
      initializedVersionRef.current = null;
      initializingVersionRef.current = null;
      setStatus(rag.status === 'loading' ? 'loading' : 'unavailable');
      return () => {
        cancelled = true;
      };
    }
    const packageVersion = knowledgePackage.manifest.packageVersion;
    if (
      initializedVersionRef.current === packageVersion ||
      initializingVersionRef.current === packageVersion
    ) {
      return () => {
        cancelled = true;
      };
    }

    const initializeModels = async () => {
      initializingVersionRef.current = packageVersion;
      setStatus('loading');
      setError(null);
      try {
        const {manifest: packageManifest} = knowledgePackage;
        const llmManifest = packageManifest.llm;
        const remote = llmManifest.provider === 'openrouter';
        // En modo remoto no se inicializa llama.rn con el GGUF del LLM; el
        // embedding GGUF local se carga siempre (el retrieval sigue on-device).
        const chatModelPath = llmManifest.modelPath;
        if (!remote && !chatModelPath) {
          throw new Error(
            'El paquete no declara llm.modelPath para el modo local.',
          );
        }
        const [systemPrompt] = await Promise.all([
          llmManifest.systemPromptPath
            ? RNFS.readFile(
                knowledgePackage.resolvePath(llmManifest.systemPromptPath),
                'utf8',
              )
            : Promise.resolve(undefined),
          remote
            ? Promise.resolve()
            : loadChatModel(knowledgePackage.resolvePath(chatModelPath!)),
          loadEmbeddingModel(
            knowledgePackage.resolvePath(packageManifest.embedding.modelPath),
          ),
        ]);
        if (cancelled) return;
        promptRef.current = systemPrompt;
        initializedVersionRef.current = packageManifest.packageVersion;
        initializingVersionRef.current = null;
        setStatus('ready');
        if (remote) {
          // La key efectiva es la del manifest (override de builds internas)
          // o la que el usuario guardó en Ajustes.
          const availableKey =
            llmManifest.apiKey ?? (await getStoredOpenRouterApiKey());
          if (cancelled) return;
          setHasRemoteApiKey(availableKey !== null);
          console.log(
            `remote: modo remoto OpenRouter (${llmManifest.id}), apiKey ${
              availableKey ? 'disponible' : 'NO configurada'
            }`,
          );
        } else {
          // Precarga en background del system prompt en el KV cache.
          warmupChat(systemPrompt).catch(() => undefined);
        }
      } catch (cause) {
        if (cancelled) return;
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        initializingVersionRef.current = null;
        setError(nextError);
        setStatus('error');
      }
    };

    initializeModels().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [
    loadChatModel,
    loadEmbeddingModel,
    warmupChat,
    rag.installedPackage,
    rag.status,
  ]);

  const send = useCallback(
    async (question: string): Promise<OfflineChatAnswer> => {
      const normalizedQuestion = question.trim();
      if (!manifest || status !== 'ready' || !normalizedQuestion) {
        throw new Error('El chat offline todavía no está listo.');
      }

      // Sin key efectiva el envío se bloquea antes de tocar la red; la UI
      // muestra el aviso accionable via missingApiKey.
      let remoteApiKey: string | null = null;
      if (isRemote) {
        remoteApiKey =
          manifest.llm.apiKey ?? (await getStoredOpenRouterApiKey());
        if (!remoteApiKey) {
          setHasRemoteApiKey(false);
          throw new MissingOpenRouterApiKeyError();
        }
        setHasRemoteApiKey(true);
      }

      setStatus('generating');
      setError(null);
      const createdAt = new Date().toISOString();
      const nextAnswer: OfflineChatAnswer = {
        id: `consultation-${Date.now()}`,
        question: normalizedQuestion,
        text: '',
        sources: [],
        createdAt,
      };
      setAnswer(nextAnswer);

      try {
        const embedding = await vectorize(
          normalizedQuestion,
          manifest.embedding.queryPrefix ?? '',
        );
        const sources = await similaritySearch(normalizedQuestion, embedding);
        if (sources.length === 0) {
          const withoutContext = {
            ...nextAnswer,
            text: 'No encuentro esa información en las guías cargadas.',
            sources,
          };
          setAnswer(withoutContext);
          setStatus('ready');
          return withoutContext;
        }
        const messages: ChatLine[] = [
          ...historyRef.current,
          {role: 'user', content: normalizedQuestion},
        ];
        const onPartial = (partial: string) =>
          setAnswer({...nextAnswer, text: partial, sources});
        let text: string;
        if (isRemote) {
          const llmManifest = manifest.llm;
          if (!llmManifest.remoteModelId) {
            throw new Error('El paquete remoto no declara llm.remoteModelId.');
          }
          const controller = new AbortController();
          remoteAbortRef.current = controller;
          try {
            text = await generateRemoteCompletion(
              {
                apiKey: remoteApiKey!,
                model: llmManifest.remoteModelId,
                temperature: numericCompletionParam(
                  llmManifest.completionParams,
                  'temperature',
                ),
                maxTokens: numericCompletionParam(
                  llmManifest.completionParams,
                  'max_tokens',
                ),
              },
              buildRemoteMessages(messages, sources, promptRef.current),
              onPartial,
              controller.signal,
            );
          } finally {
            remoteAbortRef.current = null;
          }
        } else {
          text = await generate(messages, sources, onPartial, promptRef.current);
        }
        const completed = {...nextAnswer, text, sources};
        const assistantMessage: ChatLine = {role: 'assistant', content: text};
        historyRef.current = [...messages, assistantMessage].slice(-8);
        setAnswer(completed);
        setStatus('ready');
        return completed;
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        if (nextError instanceof OpenRouterKeyInvalidError) {
          // La key existe pero fue rechazada: el chat vuelve a pedirla.
          setHasRemoteApiKey(false);
        }
        setError(nextError);
        setStatus('error');
        throw nextError;
      }
    }, [
      generate,
      isRemote,
      manifest,
      similaritySearch,
      status,
      vectorize,
    ]);

  const refreshApiKey = useCallback(async () => {
    if (!isRemote) return;
    const stored =
      manifest?.llm.apiKey ?? (await getStoredOpenRouterApiKey());
    setHasRemoteApiKey(stored !== null);
  }, [isRemote, manifest]);

  const clear = useCallback(() => {
    historyRef.current = [];
    setAnswer(null);
  }, []);

  const stop = useCallback(() => {
    stopGeneration();
    remoteAbortRef.current?.abort();
  }, [stopGeneration]);

  const missingApiKey = isRemote === true && hasRemoteApiKey === false;

  return {status, error, answer, missingApiKey, refreshApiKey, send, clear, stop};
}
