import { createContext, useContext } from 'react'
import type { Bet, BetType, Outcome, ScoringConfig } from '../lib/scoring'
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
  infoUrl: string | null
}

export interface MatchResult {
  homeScore: number | null
  awayScore: number | null
  answer: boolean | null
  outcome: Outcome | null
}

export interface ImportRow {
  /** ISO timestamp (UTC). */
  kickoff: string
  /** League name; matched to an existing competition by name (case-insensitive) or created. */
  competition: string
  betType: BetType
  question: string | null
  homeTeam: string
  awayTeam: string
  infoUrl: string | null
}

/** Admin writes. Only present for admins; the database enforces this again via RLS. */
export interface AdminApi {
  createMatch(input: MatchInput): Promise<void>
  updateMatch(id: string, input: MatchInput): Promise<void>
  deleteMatch(id: string): Promise<void>
  /** Sets the result and marks the match finished; the database computes the points. */
  finalizeMatch(id: string, result: MatchResult): Promise<void>
  importMatches(rows: ImportRow[]): Promise<{ imported: number; skipped: number; newCompetitions: number }>
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
