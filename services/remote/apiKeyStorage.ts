import AsyncStorage from '@react-native-async-storage/async-storage';

const OPENROUTER_API_KEY_STORAGE_KEY = '@infecto-assist/openrouter-api-key';

/**
 * Lee la API key de OpenRouter guardada por el usuario en Ajustes.
 * Devuelve null si no hay ninguna o si el storage no está disponible.
 */
export async function getStoredOpenRouterApiKey(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY);
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

export async function saveOpenRouterApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new Error('La API key no puede estar vacía.');
  }
  await AsyncStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, trimmed);
}

export async function clearOpenRouterApiKey(): Promise<void> {
  await AsyncStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY);
}

/**
 * Enmascara una key para mostrarla en UI: conserva el prefijo y los últimos
 * 4 caracteres (p.ej. "sk-or-...wxyz").
 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return '…';
  }
  const prefix = trimmed.startsWith('sk-or-') ? 'sk-or-' : trimmed.slice(0, 4);
  return `${prefix}...${trimmed.slice(-4)}`;
}
