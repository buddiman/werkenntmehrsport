import { createContext, useContext } from 'react'
import type { BetType, Bet, ScoringConfig } from '../lib/scoring'
import type {
  Competition,
  LeaderboardEntry,
  Match,
  Player,
  Prediction,
  PredictionScore,
  Team,
} from '../types/domain'

export interface MatchInput {
  competitionId: string
  homeTeamName: string
  awayTeamName: string
  /** ISO timestamp (UTC). */
  kickoff: string
  betType: BetType
  question: string | null
}

export interface MatchResult {
  homeScore: number | null
  awayScore: number | null
  answer: boolean | null
}

export interface ImportRow {
  /** ISO timestamp (UTC). */
  kickoff: string
  homeTeam: string
  awayTeam: string
}

/** Admin writes. Only present for admins; the database enforces this again via RLS. */
export interface AdminApi {
  createMatch(input: MatchInput): Promise<void>
  updateMatch(id: string, input: MatchInput): Promise<void>
  deleteMatch(id: string): Promise<void>
  /** Sets the result and marks the match finished; the database computes the points. */
  finalizeMatch(id: string, result: MatchResult): Promise<void>
  importMatches(
    rows: ImportRow[],
    options: { competitionId: string; betType: BetType; question: string | null },
  ): Promise<{ imported: number; skipped: number }>
  updateScoring(config: ScoringConfig): Promise<void>
}

/** Everything the UI needs. Implemented by SupabaseProvider and DemoProvider. */
export interface DataValue {
  isDemo: boolean
  me: Player
  seasonName: string
  matches: Match[]
  players: Player[]
  predictions: Prediction[]
  leaderboard: LeaderboardEntry[]
  competitions: Competition[]
  teams: Team[]
  scoring: ScoringConfig
  scoreOf(predictionId: string): PredictionScore | null
  savePrediction(matchId: string, bet: Bet): Promise<void>
  updateProfile(displayName: string, avatar: string): Promise<void>
  changePassword: ((password: string) => Promise<void>) | null
  signOut: (() => Promise<void>) | null
  admin: AdminApi | null
}

export const DataContext = createContext<DataValue | null>(null)

/** Single access point for app data. */
export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside a data provider')
  return ctx
}
