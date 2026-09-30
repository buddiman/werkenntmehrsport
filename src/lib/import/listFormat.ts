import type { BetType } from '../scoring'
import { isHttpUrl } from '../url'
import type { ImportLineError, MatchImportParser, ParsedMatch } from './types'

const DATE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/

/** Canonical names first; the German aliases are a forgiving extra for hand-written lists. */
const BET_TYPES: Record<string, BetType> = {
  score: 'score',
  ergebnis: 'score',
  '1x2': 'outcome',
  outcome: 'outcome',
  winner: 'winner',
  sieger: 'winner',
  yesno: 'yesno',
  'ja/nein': 'yesno',
  frage: 'yesno',
}

const EXAMPLE = `2026-10-03 15:30 | Bundesliga | score | Bayern München | Borussia Dortmund | | https://www.kicker.de/
2026-10-03 18:30 | Bundesliga | yesno | RB Leipzig | SC Freiburg | Fallen mehr als 3 Tore? |
2026-10-04 15:30 | Bundesliga | 1x2 | VfB Stuttgart | Werder Bremen
2026-10-14 20:45 | DFB-Pokal | winner | Hamburger SV | Mainz 05`

const INSTRUCTIONS = `Gib ausschließlich Zeilen im folgenden Format aus, eine Zeile pro Spiel, ohne weiteren Text:
Datum Uhrzeit | Liga | Tipp-Art | Heim | Gast | Frage | Link
- Datum Uhrzeit: JJJJ-MM-TT HH:mm (24 Stunden, deutsche Zeit) = Anpfiff
- Liga: Name der Liga/des Wettbewerbs, z. B. Bundesliga
- Tipp-Art (genau ein Wert): score = Ergebnis tippen | 1x2 = Heimsieg/Unentschieden/Auswärtssieg | winner = Sieger ohne Unentschieden | yesno = Ja/Nein-Frage
- Heim, Gast: Teamnamen, einheitlich geschrieben
- Frage: nur bei yesno (Pflicht), z. B. "Gibt es eine rote Karte?", sonst leer lassen
- Link: optional, https://… zu Statistiken (Kicker, Flashscore), sonst leer lassen
Die letzten beiden Spalten dürfen weggelassen werden. Beispiel:
${EXAMPLE}`

/**
 * `date | league | bet type | home | away [| question [| link]]`, one match per line.
 * Empty trailing columns may be omitted. `#` starts a comment line.
 */
export const listFormatParser: MatchImportParser = {
  id: 'list',
  label: 'Liste mit Liga und Tipp-Art',
  example: EXAMPLE,
  instructions: INSTRUCTIONS,
  parse(text) {
    const matches: ParsedMatch[] = []
    const errors: ImportLineError[] = []

    text.split(/\r?\n/).forEach((raw, index) => {
      const line = index + 1
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const fail = (message: string) => errors.push({ line, raw, message })
      const parts = trimmed.split('|').map((p) => p.trim())
      if (parts.length < 5 || parts.length > 7) {
        return fail('Erwartet "Datum Uhrzeit | Liga | Tipp-Art | Heim | Gast | Frage | Link"')
      }
      const [when, competition, rawType, homeTeam, awayTeam, question = '', infoUrl = ''] = parts

      const m = DATE.exec(when)
      if (!m) return fail('Datum muss so aussehen: 2026-10-03 15:30')
      const [, y, mo, d, h, mi] = m.map(Number)
      const check = new Date(y, mo - 1, d, h, mi)
      if (check.getMonth() !== mo - 1 || check.getDate() !== d || h > 23 || mi > 59) {
        return fail('Kein gültiges Datum / keine gültige Uhrzeit')
      }

      if (!competition) return fail('Die Liga fehlt')
      if (competition.length > 60) return fail('Der Liga-Name ist zu lang')
      const betType = BET_TYPES[rawType.toLowerCase().replace(/\s+/g, '')]
      if (!betType) return fail(`Unbekannte Tipp-Art "${rawType}". Erlaubt: score, 1x2, winner, yesno`)

      if (!homeTeam || !awayTeam) return fail('Beide Teamnamen werden benötigt')
      if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) return fail('Die Teams müssen verschieden sein')

      if (betType === 'yesno' && !question) return fail('Bei yesno fehlt die Frage')
      if (betType !== 'yesno' && question) return fail('Eine Frage gibt es nur bei yesno')
      if (infoUrl && !isHttpUrl(infoUrl)) return fail('Der Link muss mit http:// oder https:// beginnen')

      const pad = (n: number) => String(n).padStart(2, '0')
      matches.push({
        kickoff: `${m[1]}-${m[2]}-${m[3]}T${pad(h)}:${m[5]}`,
        competition,
        betType,
        question: question || null,
        homeTeam,
        awayTeam,
        infoUrl: infoUrl || null,
      })
    })

    return { matches, errors }
  },
}
