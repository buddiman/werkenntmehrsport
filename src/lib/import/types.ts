/**
 * Match import. Each supported input format is a `MatchImportParser`.
 * To add a format (e.g. CSV): implement the interface, then register it in `./index.ts`.
 * The admin UI picks it up automatically (selector, instructions, preview).
 */
import type { BetType } from '../scoring'

export interface ParsedMatch {
  /** Local date-time as entered, "YYYY-MM-DDTHH:mm". Timezone is applied on save. */
  kickoff: string
  /** League name as written; matched to existing competitions by name, created if new. */
  competition: string
  betType: BetType
  /** Yes/No question text; only for betType 'yesno'. */
  question: string | null
  homeTeam: string
  awayTeam: string
  /** Optional link with stats, e.g. Kicker or Flashscore. */
  infoUrl: string | null
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
  /** Shown as textarea placeholder. */
  example: string
  /** Short, self-contained instructions that can be pasted into an LLM to produce this format. */
  instructions: string
  parse(text: string): ImportResult
}
