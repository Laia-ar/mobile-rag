import {ChatLine} from '../../hooks/useLlamaEngine';

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_KEY_URL = 'https://openrouter.ai/api/v1/key';

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

interface OpenRouterResponse {
  choices?: Array<{message?: {content?: unknown}}>;
  usage?: {completion_tokens?: number};
}

export class OpenRouterKeyInvalidError extends Error {
  constructor() {
    super('La API key de OpenRouter no es válida. Revisala en Ajustes.');
    this.name = 'OpenRouterKeyInvalidError';
  }
}

export interface OpenRouterKeyInfo {
  usage: number;
  limit: number | null;
  limitRemaining: number | null;
  isFreeTier: boolean;
}

/**
 * Consulta GET /key de OpenRouter para conocer uso y crédito de una API key.
 * Lanza OpenRouterKeyInvalidError ante un 401.
 */
export async function fetchOpenRouterKeyInfo(
  apiKey: string,
  signal?: AbortSignal,
): Promise<OpenRouterKeyInfo> {
  console.log('remote: consultando crédito de la API key');
  const response = await fetch(OPENROUTER_KEY_URL, {
    method: 'GET',
    headers: {Authorization: `Bearer ${apiKey}`},
    signal,
  });
  if (response.status === 401) {
    throw new OpenRouterKeyInvalidError();
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `OpenRouter respondió ${response.status}: ${body.slice(0, 300)}`,
    );
  }
  const payload = (await response.json()) as {data?: Record<string, unknown>};
  const data = payload.data ?? {};
  const numberOrNull = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  return {
    usage: numberOrNull(data.usage) ?? 0,
    limit: numberOrNull(data.limit),
    limitRemaining: numberOrNull(data.limit_remaining),
    isFreeTier: data.is_free_tier === true,
  };
}

/**
 * Texto de crédito para mostrar en Ajustes. Con límite configurado muestra el
 * restante en US$; si la key no tiene límite, muestra el uso acumulado.
 */
export function formatCreditInfo(info: OpenRouterKeyInfo): string {
  if (info.limitRemaining !== null) {
    return `Crédito restante: US$ ${info.limitRemaining.toFixed(2)}`;
  }
  if (info.limit === null) {
    return `Uso acumulado: US$ ${info.usage.toFixed(2)} (sin límite)`;
  }
  return `Crédito: US$ ${info.limit.toFixed(2)} - usado US$ ${info.usage.toFixed(2)}`;
}

/**
 * Llama a POST /chat/completions de OpenRouter (API OpenAI-compatible).
 *
 * fetch de React Native no streamea SSE de forma confiable, así que se pide
 * "stream": false y el texto completo se emite por onPartialResponse en
 * pedazos simulados para que la UI lo muestre de forma incremental.
 *
 * Los console.log con prefijo "remote:" están pensados para medir latencia
 * desde logcat.
 */
export async function generateRemoteCompletion(
  config: OpenRouterConfig,
  messages: ChatLine[],
  onPartialResponse: (partial: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  console.log(`remote: request enviado (model=${config.model})`);
  const startTime = Date.now();

  let payload: OpenRouterResponse;
  try {
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        ...(config.temperature !== undefined
          ? {temperature: config.temperature}
          : {}),
        ...(config.maxTokens !== undefined
          ? {max_tokens: config.maxTokens}
          : {}),
      }),
      signal,
    });
    if (response.status === 401) {
      throw new OpenRouterKeyInvalidError();
    }
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `OpenRouter respondió ${response.status}: ${body.slice(0, 300)}`,
      );
    }
    payload = (await response.json()) as OpenRouterResponse;
  } catch (err) {
    if (signal?.aborted) {
      console.log('remote: generación abortada por el usuario');
      return '';
    }
    throw err;
  }

  const rawContent = payload.choices?.[0]?.message?.content;
  const text =
    typeof rawContent === 'string'
      ? rawContent
      : Array.isArray(rawContent)
        ? rawContent
            .map(part =>
              typeof part === 'object' && part !== null && 'text' in part
                ? String((part as {text: unknown}).text)
                : '',
            )
            .join('')
        : '';
  const tokens = payload.usage?.completion_tokens;
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(
    `remote: respuesta recibida en ${elapsed.toFixed(1)}s, ${tokens ?? '?'} tokens`,
  );

  // Emisión en pedazos para simular streaming en la UI.
  const CHUNK_SIZE = 24;
  let emitted = '';
  for (let index = 0; index < text.length; index += CHUNK_SIZE) {
    if (signal?.aborted) {
      console.log('remote: generación abortada por el usuario');
      return emitted;
    }
    emitted = text.slice(0, index + CHUNK_SIZE);
    onPartialResponse(emitted);
    await new Promise<void>(resolve => setTimeout(resolve, 10));
  }
  return text;
}
