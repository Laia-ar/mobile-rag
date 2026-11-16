export class MobileError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
export function backendOrigin(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^https?:\/\/[^/]+\/?$/.test(value) ||
    /[@?#\s]/.test(value)
  ) {
    throw new MobileError(
      0,
      'Falta configurar la dirección del backend de registro.',
    );
  }
  return value.replace(/\/$/, '');
}
export async function backendRequest<T>(
  origin: string,
  path: string,
  payload: unknown,
  method = 'POST',
): Promise<T> {
  const base = backendOrigin(origin);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        data && typeof data === 'object' && 'detail' in data
          ? data.detail
          : null;
      throw new MobileError(
        response.status,
        typeof detail === 'string'
          ? detail
          : 'No se pudo completar la operación.',
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof MobileError) throw error;
    throw new MobileError(0, 'No se pudo conectar con el servidor.');
  } finally {
    clearTimeout(timeout);
  }
}
