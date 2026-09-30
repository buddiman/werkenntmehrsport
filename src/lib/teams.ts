/** Short code for a new team, e.g. "Bayern München" -> "BAY", "1. FC Köln" -> "FCK". */
export function shortNameFor(name: string): string {
  const letters = name.replace(/[^\p{L}]/gu, '').toUpperCase()
  return letters.length === 0 ? 'TBD' : letters.slice(0, 3).padEnd(2, 'X')
}
