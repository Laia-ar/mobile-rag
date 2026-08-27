import {CompletionParams, ContextParams} from 'llama.rn';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import RNFS from 'react-native-fs';
import {ChatLine, useLlamaEngine} from './useLlamaEngine';
import {UseSQLiteRAGReturn} from './useRagEngine';
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

const EMBEDDING_CONTEXT_PARAMS: Partial<ContextParams> = {embedding: true};
const EMPTY_COMPLETION_PARAMS: Partial<CompletionParams> = {};

export function useOfflineChat(rag: UseSQLiteRAGReturn) {
  const manifest = rag.installedPackage?.manifest;
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
  const generate = chatEngine.generate;
  const stopGeneration = chatEngine.stopGeneration;
  const loadEmbeddingModel = embeddingEngine.loadModel;
  const vectorize = embeddingEngine.vectorize;
  const similaritySearch = rag.similaritySearch;
  const [status, setStatus] = useState<OfflineChatStatus>('unavailable');
  const [error, setError] = useState<Error | null>(null);
  const [answer, setAnswer] = useState<OfflineChatAnswer | null>(null);
  const promptRef = useRef<string | undefined>(undefined);
  const historyRef = useRef<ChatLine[]>([]);
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
        const [systemPrompt] = await Promise.all([
          packageManifest.llm.systemPromptPath
            ? RNFS.readFile(
                knowledgePackage.resolvePath(
                  packageManifest.llm.systemPromptPath,
                ),
                'utf8',
              )
            : Promise.resolve(undefined),
          loadChatModel(
            knowledgePackage.resolvePath(packageManifest.llm.modelPath),
          ),
          loadEmbeddingModel(
            knowledgePackage.resolvePath(packageManifest.embedding.modelPath),
          ),
        ]);
        if (cancelled) return;
        promptRef.current = systemPrompt;
        initializedVersionRef.current = packageManifest.packageVersion;
        initializingVersionRef.current = null;
        setStatus('ready');
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
    rag.installedPackage,
    rag.status,
  ]);

  const send = useCallback(
    async (question: string): Promise<OfflineChatAnswer> => {
      const normalizedQuestion = question.trim();
      if (!manifest || status !== 'ready' || !normalizedQuestion) {
        throw new Error('El chat offline todavía no está listo.');
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
        const text = await generate(
          messages,
          sources,
          partial => setAnswer({...nextAnswer, text: partial, sources}),
          promptRef.current,
        );
        const completed = {...nextAnswer, text, sources};
        const assistantMessage: ChatLine = {role: 'assistant', content: text};
        historyRef.current = [...messages, assistantMessage].slice(-8);
        setAnswer(completed);
        setStatus('ready');
        return completed;
      } catch (cause) {
        const nextError = cause instanceof Error ? cause : new Error(String(cause));
        setError(nextError);
        setStatus('error');
        throw nextError;
      }
    }, [
      generate,
      manifest,
      similaritySearch,
      status,
      vectorize,
    ]);

  const clear = useCallback(() => {
    historyRef.current = [];
    setAnswer(null);
  }, []);

  return {status, error, answer, send, clear, stop: stopGeneration};
}
