import type { Source } from '../types'

// La lógica se conserva, pero no está disponible desde la interfaz.
export const SOURCE_SAVING_ENABLED = false

export function sourceKey(source: Source): string {
  return JSON.stringify([source.document_id ?? source.title, source.page, source.content_preview])
}
export function loadSavedSources(key: string): Source[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is Source =>
        item !== null &&
        typeof item === 'object' &&
        typeof item.title === 'string' &&
        typeof item.content_preview === 'string' &&
        (item.document_id == null || typeof item.document_id === 'string') &&
        (item.pdf_available === undefined || typeof item.pdf_available === 'boolean') &&
        (item.page === null ||
          (typeof item.page === 'number' && Number.isInteger(item.page)))
    )
  } catch {
    return []
  }
}
