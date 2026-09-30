import type { ImportLineError, MatchImportParser, ParsedMatch } from './types'

const LINE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/

/** `YYYY-MM-DD HH:mm | Home team | Away team`, one match per line. `#` starts a comment. */
export const pipeFormatParser: MatchImportParser = {
  id: 'pipe',
  label: 'Mit senkrechtem Strich getrennt',
  example: `2026-10-03 15:30 | Bayern München | Borussia Dortmund
2026-10-03 18:30 | RB Leipzig | SC Freiburg`,
  parse(text) {
    const matches: ParsedMatch[] = []
    const errors: ImportLineError[] = []

    text.split(/\r?\n/).forEach((raw, index) => {
      const line = index + 1
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const fail = (message: string) => errors.push({ line, raw, message })
      const parts = trimmed.split('|').map((p) => p.trim())
      if (parts.length !== 3) return fail('Erwartet "Datum Uhrzeit | Heim | Gast"')

      const [when, homeTeam, awayTeam] = parts
      const m = LINE.exec(when)
      if (!m) return fail('Datum muss so aussehen: 2026-10-03 15:30')
      const [, y, mo, d, h, mi] = m.map(Number)
      const check = new Date(y, mo - 1, d, h, mi)
      if (check.getMonth() !== mo - 1 || check.getDate() !== d || h > 23 || mi > 59) {
        return fail('Kein gültiges Datum / keine gültige Uhrzeit')
      }
      if (!homeTeam || !awayTeam) return fail('Beide Teamnamen werden benötigt')
      if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return fail('Die Teams müssen verschieden sein')

      const pad = (n: number) => String(n).padStart(2, '0')
      matches.push({ kickoff: `${m[1]}-${m[2]}-${m[3]}T${pad(h)}:${m[5]}`, homeTeam, awayTeam })
    })

    return { matches, errors }
  },
}
