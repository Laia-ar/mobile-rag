export function normalizeSearch(value: string): string {
  let result = ''
  for (const letter of value.normalize('NFD')) {
    const code = letter.codePointAt(0) ?? 0
    if (code < 0x0300 || code > 0x036f) result += letter
  }
  return result.trim().toLocaleLowerCase('es')
}
