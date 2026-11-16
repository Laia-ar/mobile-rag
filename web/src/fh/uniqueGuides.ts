import type { Source } from '../types'

export function uniqueGuides(sources: Source[]): Source[] {
  const seen = new Set<string>()
  return sources.filter(source => {
    const key = source.document_id
      ? `id:${source.document_id}`
      : `title:${source.title.trim().toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
