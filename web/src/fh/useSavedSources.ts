import { useState } from 'react'
import type { Source } from '../types'
import { loadSavedSources, sourceKey, SOURCE_SAVING_ENABLED } from './savedSources'

// Conserva el almacenamiento original, aislado de las pantallas actuales.
// Para reactivarlo habrá que habilitar la función y volver a conectar sus controles.
export function useSavedSources(registrationId: string) {
  const storageKey = `palmera-web-sources:${registrationId}`
  const [savedSources, setSavedSources] = useState<Source[]>(() => loadSavedSources(storageKey))
  const [saveError, setSaveError] = useState<string | null>(null)
  const isSaved = (source: Source) =>
    savedSources.some((item) => sourceKey(item) === sourceKey(source))
  const toggleSave = (source: Source) => {
    if (!SOURCE_SAVING_ENABLED) return
    const next = isSaved(source)
      ? savedSources.filter((item) => sourceKey(item) !== sourceKey(source))
      : [...savedSources, source]
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSavedSources(next)
      setSaveError(null)
    } catch {
      setSaveError('No se pudo guardar el fragmento en este navegador. Intentá nuevamente.')
    }
  }
  return { savedSources, isSaved, toggleSave, saveError, setSaveError }
}
