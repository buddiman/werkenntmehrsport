/**
 * Domain types. These mirror the relational schema in supabase/migrations;
 * the data providers in src/data map database rows to these types. Dates are ISO-8601 strings (UTC) as returned by Postgres.
 */

import type { BetType } from '../lib/scoring'

export type MatchStatus = 'upcoming' | 'locked' | 'finished'

export interface Team {
  id: string
  name: string
  shortName: string
}

export interface Player {
  id: string
  displayName: string
  avatar: string // emoji for now; may become an image URL later
  isAdmin: boolean
}

export interface Match {
  id: string
  competitionId: string
  competition: string
  seasonId: string
  season: string
  kickoff: string
  predictionDeadline: string
  homeTeam: Team
  awayTeam: Team
  /** Stored status. Use `effectiveStatus()` for the status shown to users. */
  status: MatchStatus
  /** Exactly one bet type per match. */
  betType: BetType
  /** Yes/No question, set only when betType is 'yesno', e.g. "Over 2.5 goals?" */
  question: string | null
  /** Actual result. homeScore/awayScore for 'score' matches, answer for 'yesno' matches. */
  homeScore: number | null
  awayScore: number | null
  answer: boolean | null
}

export interface Prediction {
  id: string
  matchId: string
  playerId: string
  /** Score bet: both set. Yes/No bet: both null. */
  homeScore: number | null
  awayScore: number | null
  /** Yes/No bet: set. Score bet: null. */
  answer: boolean | null
  createdAt: string
}

export interface LeaderboardEntry {
  player: Player
  rank: number
  points: number
  exactPredictions: number
  correctResults: number
  predictions: number
}

export interface Competition {
  id: string
  name: string
}

/** Points a prediction earned (server-computed in Supabase mode). */
export interface PredictionScore {
  points: number
  isExact: boolean
  /** Correct result 1/X/2 (score bets) or correct answer (Yes/No bets). */
  isCorrect: boolean
}
