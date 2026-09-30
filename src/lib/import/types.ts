/**
 * Match import. Each supported input format is a `MatchImportParser`.
 * To add a format (e.g. a Kicker copy/paste, CSV): implement the interface,
 * then register it in `./index.ts`. The admin UI picks it up automatically.
 */

export interface ParsedMatch {
  /** Local date-time as entered, "YYYY-MM-DDTHH:mm". Timezone is applied on save. */
  kickoff: string
  homeTeam: string
  awayTeam: string
}

export interface ImportLineError {
  line: number
  raw: string
  message: string
}

export interface ImportResult {
  matches: ParsedMatch[]
  errors: ImportLineError[]
}

export interface MatchImportParser {
  id: string
  label: string
  /** Shown as help text and as the textarea placeholder. */
  example: string
  parse(text: string): ImportResult
}
