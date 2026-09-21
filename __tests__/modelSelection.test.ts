import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearSelectedRemoteModelId,
  getSelectedRemoteModelId,
  saveSelectedRemoteModelId,
} from '../services/remote/modelSelection';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const STORAGE_KEY = '@infecto-assist/remote-model-selection';

describe('modelSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hace roundtrip: guarda y lee el id de la opción elegida', async () => {
    storage.getItem.mockResolvedValue('Qwen 3.5 4B');
    await saveSelectedRemoteModelId('Qwen 3.5 4B');
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'Qwen 3.5 4B');
    await expect(getSelectedRemoteModelId()).resolves.toBe('Qwen 3.5 4B');
  });

  it('devuelve null cuando no hay selección guardada', async () => {
    storage.getItem.mockResolvedValue(null);
    await expect(getSelectedRemoteModelId()).resolves.toBeNull();
  });

  it('devuelve null y avisa por consola si el storage falla', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.getItem.mockRejectedValue(new Error('storage caído'));
    await expect(getSelectedRemoteModelId()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('rechaza guardar un id vacío', async () => {
    await expect(saveSelectedRemoteModelId('   ')).rejects.toThrow('vacía');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('limpia la selección guardada', async () => {
    await clearSelectedRemoteModelId();
    expect(storage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
  });
});
