import AsyncStorage from '@react-native-async-storage/async-storage';

const REMOTE_MODEL_SELECTION_STORAGE_KEY =
  '@infecto-assist/remote-model-selection';

/**
 * Lee el id de la opción de modelo remoto elegida por el usuario (chip del
 * chat). Devuelve null si no hay ninguna o si el storage no está disponible.
 */
export async function getSelectedRemoteModelId(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(REMOTE_MODEL_SELECTION_STORAGE_KEY);
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  } catch (error) {
    console.warn('remote: no se pudo leer la selección de modelo remoto', error);
    return null;
  }
}

export async function saveSelectedRemoteModelId(id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) {
    throw new Error('La opción de modelo remoto no puede estar vacía.');
  }
  await AsyncStorage.setItem(REMOTE_MODEL_SELECTION_STORAGE_KEY, trimmed);
}

export async function clearSelectedRemoteModelId(): Promise<void> {
  await AsyncStorage.removeItem(REMOTE_MODEL_SELECTION_STORAGE_KEY);
}
