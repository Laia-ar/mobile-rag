/**
 * useLlamaEngine.js
 * ------------------------------------------------------------------
 * Hook que encapsula todo el ciclo de vida de llama.rn:
 *   - descarga / selección del modelo GGUF
 *   - inicialización del contexto LLM
 *   - inferencia con streaming token a token
 *   - limpieza de recursos
 *
 * Dependencias:
 *   npm install llama.rn react-native-fs react-native-document-picker
 *   npx pod-install   (iOS)
 * ------------------------------------------------------------------
 */

import {
  CompletionParams,
  ContextParams,
  initLlama,
  LlamaContext,
  NativeEmbeddingParams,
} from 'llama.rn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';


// /**
//  * Directorio donde se guardan los modelos descargados.
//  * En iOS usa DocumentDirectoryPath (persiste entre reinicios).
//  * En Android usa ExternalDirectoryPath o DocumentDirectoryPath.
//  */
// const MODELS_DIR =
//   Platform.OS === 'ios'
//     ? `${RNFS.DocumentDirectoryPath}/models`
//     : `${RNFS.ExternalDirectoryPath ?? RNFS.DocumentDirectoryPath}/models`;

/**
 * Parámetros del contexto llama.cpp.
 * Ajustalos según la RAM del dispositivo y el tamaño del modelo.
 */
const DEFAULT_CONTEXT_PARAMS: Partial<ContextParams> = {
  n_ctx: 2048,

  n_gpu_layers: Platform.OS === 'ios' ? 99 : 0,

  n_threads: undefined,

  use_mmap: true,

  use_mlock: false,
};

/**
 * Parámetros de generación de texto.
 */
const DEFAULT_COMPLETION_PARAMS = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,

  n_predict: 512,

  stop: [
    '<|eot_id|>',
    '<|end_of_text|>',
    '</s>',
    '[/INST]',
    'User:',
    '\nUser:',
  ],
};

/**
 * Convierte un array de mensajes al formato Llama 3 Instruct.
 * Usar este template con: Llama-3.x-*-Instruct, SmolLM2-Instruct
 *
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {string} systemPrompt
 * @returns {string}
 */
export function formatLlama3Prompt(
  messages: Array<ChatLine>,
  systemPrompt: string = 'Eres un asistente útil y conciso.',
): string {
  let prompt = `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n${systemPrompt}<|eot_id|>`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      prompt += `<|start_header_id|>user<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    } else if (msg.role === 'assistant') {
      prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n${msg.content}<|eot_id|>`;
    }
  }

  prompt += `<|start_header_id|>assistant<|end_header_id|>\n\n`;
  return prompt;
}

type ChatLine = { role: 'system' | 'user' | 'assistant'; content: string };
/**
 * Template Mistral / Alpaca [INST].
 * Usar con: Mistral-7B-Instruct, DeepSeek-R1-Distill-*
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt
 * @returns {string}
 */
export function formatMistralPrompt(
  messages: Array<ChatLine>,
  systemPrompt: string = 'Eres un asistente útil.',
): string {
  let prompt = `[INST] ${systemPrompt}\n\n`;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'user') {
      prompt += i === 0 ? msg.content : `[INST] ${msg.content} [/INST]`;
    } else if (msg.role === 'assistant') {
      prompt += ` ${msg.content} `;
    }
  }

  if (messages[messages.length - 1]?.role === 'user') {
    prompt += ' [/INST]';
  }

  return prompt;
}

/**
 * Template ChatML — usado por Qwen, Phi, muchos fine-tunes
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt
 * @returns {string}
 */
export function formatChatMLPrompt(
  messages: Array<ChatLine>,
  systemPrompt: string = 'Eres un asistente útil.',
): string {
  let prompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n`;

  for (const msg of messages) {
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  }

  prompt += `<|im_start|>assistant\n`;
  return prompt;
}

/**
 * @typedef {'idle' | 'loading' | 'ready' | 'generating' | 'error'} EngineStatus
 */

/**
 * @typedef {Object} EngineState
 * @property {EngineStatus} status
 * @property {string|null} modelName   - nombre del archivo cargado
 * @property {string|null} modelPath   - ruta completa del modelo
 * @property {string} error            - mensaje de error si status === 'error'
 * @property {number} downloadProgress - 0-100 durante descarga
 * @property {number} tokensPerSec     - velocidad de generación
 */

/**
 * useLlamaEngine()
 *
 * Uso:
 *   const {
 *     status, modelName, error,
 *     loadModelFromPath, loadModelFromUrl,
 *     generate, stopGeneration,
 *     unloadModel,
 *   } = useLlamaEngine();
 */
export function useLlamaEngine(options: {
  contextParams: Partial<ContextParams>;
  completionParams: Partial<CompletionParams>;
  onToken?: (t: string) => void;
  onStats?: ({ tokensPerSec }: { tokensPerSec: number }) => void;
}) {
  const {
    contextParams = {},
    completionParams = {},
    onToken,
    onStats,
  } = options;

  const [status, setStatus] = useState<
    'idle' | 'generating' | 'ready' | 'loading' | 'error' | ''
  >('idle');
  const [modelName, setModelName] = useState<string>();
  const [modelPath, setModelPath] = useState<string>();
  const [error, setError] = useState('');
  const [tokensPerSec, setTokensPerSec] = useState(0);

  const contextRef = useRef<LlamaContext>(undefined);
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      __releaseContext();
    };
  }, []);

  async function __releaseContext() {
    if (contextRef.current) {
      try {
        await contextRef.current.release();
      } catch (_) {}
      contextRef.current = undefined;
    }
  }

  async function __initContext(path: string) {
    await __releaseContext();

    const params: ContextParams = {
      ...DEFAULT_CONTEXT_PARAMS,
      ...contextParams,
      model: path,
    };

    if (!params.n_threads) {
      params.n_threads = 4;
    }

    contextRef.current = await initLlama(params);
  }

  const loadModelFromPath = useCallback(async (file: string) => {
    try {
      setStatus('loading');
      setError('');
      // const asd = await RNFS.pathForBundle(`knowledge.current/${file}`)
      
      const path = `knowledge.current/${file}`
      const folder = `${RNFS.TemporaryDirectoryPath}/models`
      const dest = `${folder}/${file}`
      const present = await RNFS.exists(dest);
      if (!present) {
        console.log("copy model to ", dest)
        const exists = await RNFS.existsAssets(path);
        if (!exists) throw new Error(`Archivo no encontdrado: ${path}`);
        await RNFS.mkdir(folder)
        await RNFS.copyFileAssets(path, dest)
      }

      await __initContext(dest);
      console.log("model loaded:", dest)

      const name = path.split('/').pop();
      setModelName(name);
      setModelPath(path);
      setStatus('ready');
    } catch (err: unknown) {
      setError(toError(err).message);
      setStatus('error');
      throw err;
    }
  }, []);

  const generate = useCallback(
    async (
      messages: ChatLine[],
      systemPrompt = 'Eres un asistente útil y conciso.',
      template: 'llama3' | 'mistral' | 'chatml' = 'llama3',
      onPartialResponse: (p: string) => void,
    ) => {
      if (!contextRef.current) throw new Error('Modelo no cargado: generate');
      if (status === 'generating')
        throw new Error('Ya hay una generación en curso');

      setStatus('generating');
      abortRef.current = false;

      let prompt;
      switch (template) {
        case 'mistral':
          prompt = formatMistralPrompt(messages, systemPrompt);
          break;
        case 'chatml':
          prompt = formatChatMLPrompt(messages, systemPrompt);
          break;
        default:
          prompt = formatLlama3Prompt(messages, systemPrompt);
          break;
      }

      const params = {
        ...DEFAULT_COMPLETION_PARAMS,
        ...completionParams,
        prompt,
      };

      let fullText = '';
      let tokenCount = 0;
      const startTime = Date.now();

      try {
        const result = await contextRef.current.completion(params, data => {
          if (abortRef.current) return;

          console.log("data", data)
          fullText += data.token;
          tokenCount++;

          if (tokenCount % 10 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const tps = Math.round(tokenCount / elapsed);
            setTokensPerSec(tps);
            onStats?.({ tokensPerSec: tps });
          }

          onToken?.(data.token);
          onPartialResponse?.(fullText);
        });

        setStatus('ready');
        return result.text ?? fullText;
      } catch (err) {
        if (!abortRef.current) {
          setError(toError(err).message);
          setStatus('error');
        } else {
          setStatus('ready');
        }
        return fullText;
      }
    },
    [status, completionParams, onToken, onStats],
  );

  const vectorize = useCallback(
    async (message: string) => {
      if (!contextRef.current) throw new Error('Modelo no cargado: vectorize');
      if (status === 'generating')
        throw new Error('Ya hay una generación en curso');

      setStatus('generating');
      abortRef.current = false;

      const params: NativeEmbeddingParams = {};

      try {
        const result = await contextRef.current.embedding(message, params);
        setStatus('ready');
        return result.embedding;
      } catch (err) {
        console.log(err)
        if (!abortRef.current) {
          setError(toError(err).message);
          setStatus('error');
        } else {
          setError(toError(err).message);
          setStatus('ready');
        }
        return [];
      }
    },
    [status, completionParams],
  );

  /**
   * Detiene la generación en curso.
   */
  const stopGeneration = useCallback(() => {
    abortRef.current = true;
    contextRef.current?.stopCompletion?.();
  }, []);

  /**
   * Libera el contexto llama.cpp y resetea el estado.
   */
  const unloadModel = useCallback(async () => {
    stopGeneration();
    await __releaseContext();
    setStatus('idle');
    setModelName(undefined);
    setModelPath(undefined);
    setTokensPerSec(0);
  }, [stopGeneration]);


  return {
    status,
    modelName,
    modelPath,
    error,
    tokensPerSec,
    vectorize,
    loadModelFromPath,
    generate,
    stopGeneration,
    unloadModel,
  };
}

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (
    e &&
    typeof e === 'object' &&
    'message' in e &&
    typeof e.message === 'string'
  )
    return new Error(e.message);
  return new Error('unkown error');
}

// export { MODELS_DIR };
