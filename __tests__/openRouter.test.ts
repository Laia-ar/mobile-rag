import {maskApiKey} from '../services/remote/apiKeyStorage';
import {
  formatCreditInfo,
  generateRemoteCompletion,
} from '../services/remote/openRouter';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe('maskApiKey', () => {
  it('enmascara una key sk-or conservando prefijo y últimos 4 caracteres', () => {
    expect(maskApiKey('sk-or-v1-abcdef1234567890wxyz')).toBe('sk-or-...wxyz');
  });

  it('enmascara keys sin prefijo sk-or', () => {
    expect(maskApiKey('abcdefghijklmnop')).toBe('abcd...mnop');
  });

  it('no expone nada de una key demasiado corta', () => {
    expect(maskApiKey('sk-short')).toBe('…');
  });
});

describe('formatCreditInfo', () => {
  it('muestra el crédito restante en US$ cuando hay límite', () => {
    expect(
      formatCreditInfo({
        usage: 1.25,
        limit: 10,
        limitRemaining: 8.75,
        isFreeTier: false,
      }),
    ).toBe('Crédito restante: US$ 8.75');
  });

  it('muestra uso acumulado y "sin límite" cuando limit es null', () => {
    expect(
      formatCreditInfo({
        usage: 3.5,
        limit: null,
        limitRemaining: null,
        isFreeTier: false,
      }),
    ).toBe('Uso acumulado: US$ 3.50 (sin límite)');
  });

  it('muestra límite y uso cuando hay límite pero no dato de restante', () => {
    expect(
      formatCreditInfo({
        usage: 2,
        limit: 5,
        limitRemaining: null,
        isFreeTier: true,
      }),
    ).toBe('Crédito: US$ 5.00 - usado US$ 2.00');
  });
});

describe('generateRemoteCompletion', () => {
  it('fusiona extraBody al final del body del POST', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{message: {content: 'hola'}}],
        usage: {completion_tokens: 2},
      }),
    });
    (globalThis as unknown as {fetch: unknown}).fetch = fetchMock;
    const text = await generateRemoteCompletion(
      {
        apiKey: 'test-key',
        model: 'qwen3.5-4b-q4km',
        baseUrl: 'http://64.176.6.198:8001/v1',
        extraBody: {chat_template_kwargs: {enable_thinking: false}},
      },
      [{role: 'user', content: 'hola'}],
      () => {},
    );
    expect(text).toBe('hola');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      {body: string},
    ];
    expect(url).toBe('http://64.176.6.198:8001/v1/chat/completions');
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe('qwen3.5-4b-q4km');
    expect(body.stream).toBe(false);
    expect(body.chat_template_kwargs).toEqual({enable_thinking: false});
  });
});
