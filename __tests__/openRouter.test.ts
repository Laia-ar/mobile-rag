import {maskApiKey} from '../services/remote/apiKeyStorage';
import {formatCreditInfo} from '../services/remote/openRouter';

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
