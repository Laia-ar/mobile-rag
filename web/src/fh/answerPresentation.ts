import type { Source } from '../types'

function titlePattern(title: string): string {
  return title.trim().replace(/\.(?:pdf|md|txt|docx?)$/i, '').split(/[\s_\-\u2010-\u2015]+/u)
    .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s_\\-\\u2010-\\u2015]+') + '(?:\\.(?:pdf|md|txt|docx?))?'
}

// Solo cambia la presentación; el historial y el registro conservan la respuesta original.
// No elimina paréntesis clínicos ni párrafos con información adicional.
export function answerForDisplay(answer: string, sources: Source[]): string {
  const titles = [...new Set(sources.flatMap(source => [source.title, ...(source.citation_titles ?? [])]))]
    .filter(title => title.trim())
  if (!titles.length) return answer
  const names = titles.sort((a, b) => b.length - a.length).map(titlePattern).join('|')
  const citation = `(?:${names})(?:\\s*,\\s*(?:p(?:ág(?:ina)?)?\\.?|pp\\.)\\s*\\d+(?:[-–]\\d+)?)?`
  const inline = new RegExp(`[ \\t]*\\(\\s*${citation}(?:\\s*;\\s*${citation})*\\s*\\)`, 'giu')
  const footerStart = /^[ \t]*(?:\*{1,2})?(?:Para m[aá]s informaci[oó]n consultar|Fuentes(?: consultadas)?|Referencias(?: bibliogr[aá]ficas)?)(?:\*{1,2})?\s*:\s*/imu
  const sourceName = new RegExp(`(?:${names})`, 'giu')
  let fence: string | null = null
  return answer.split(/(\n[ \t]*\n)/).map(block => {
    // Mantener los ejemplos de código literales, incluso si contienen citas.
    const lines = block.split('\n')
    let protectedBlock = fence !== null
    for (const line of lines) {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (!marker) continue
      protectedBlock = true
      if (fence && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      else if (!fence) fence = marker
    }
    if (protectedBlock) return block
    const footer = footerStart.exec(block)
    if (footer) {
      const tail = block.slice(footer.index + footer[0].length)
      const nextSection = tail.search(/\n(?=[ \t]*(?:Para\s|#{1,6}\s))/iu)
      const references = nextSection < 0 ? tail : tail.slice(0, nextSection)
      const remainder = references.replace(sourceName, '')
      // Solo retirar el cierre cuando contiene exclusivamente los títulos conocidos.
      if (remainder !== references && /^[\s;,.()*_\-\u2010-\u2015]*$/u.test(remainder)) {
        block = block.slice(0, footer.index).trimEnd() + (nextSection < 0 ? '' : tail.slice(nextSection))
      }
    }
    return block.replace(inline, '')
  }).join('').trim()
}
