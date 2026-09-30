import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ScoringConfig } from '../lib/scoring'
import { shortNameFor } from '../lib/teams'
import type {
  Competition,
  LeaderboardEntry,
  Match,
  Player,
  Prediction,
  PredictionScore,
  Team,
} from '../types/domain'
import { DataContext, type AdminApi, type DataValue, type MatchInput } from './context'
import { friendlyError } from './supabaseErrors'

// ---------------------------------------------------------------- row types (see supabase/migrations)

interface TeamRow { id: string; name: string; short_name: string }
interface ProfileRow { id: string; display_name: string; avatar: string; is_admin: boolean }
interface MatchRow {
  id: string
  competition_id: string
  season_id: string
  kickoff_at: string
  prediction_deadline: string
  status: Match['status']
  bet_type: Match['betType']
  question: string | null
  home_score: number | null
  away_score: number | null
  answer: boolean | null
  competition: { name: string }
  season: { name: string }
  home: TeamRow
  away: TeamRow
}
interface PredictionRow {
  id: string
  match_id: string
  player_id: string
  home_score: number | null
  away_score: number | null
  answer: boolean | null
  created_at: string
}
interface ScoreRow { prediction_id: string; points: number; is_exact: boolean; is_correct: boolean }
interface LeaderboardRow {
  player_id: string
  total_points: number
  exact_predictions: number
  correct_results: number
  predictions: number
  rank: number
}
interface ScoringRow {
  exact_score: number
  goal_difference: number
  correct_result: number
  correct_answer: number
}

const toTeam = (r: TeamRow): Team => ({ id: r.id, name: r.name, shortName: r.short_name })
const toPlayer = (r: ProfileRow): Player => ({
  id: r.id,
  displayName: r.display_name,
  avatar: r.avatar,
  isAdmin: r.is_admin,
})
const toMatch = (r: MatchRow): Match => ({
  id: r.id,
  competitionId: r.competition_id,
  competition: r.competition.name,
  seasonId: r.season_id,
  season: r.season.name,
  kickoff: r.kickoff_at,
  predictionDeadline: r.prediction_deadline,
  homeTeam: toTeam(r.home),
  awayTeam: toTeam(r.away),
  status: r.status,
  betType: r.bet_type,
  question: r.question,
  homeScore: r.home_score,
  awayScore: r.away_score,
  answer: r.answer,
})
const toPrediction = (r: PredictionRow): Prediction => ({
  id: r.id,
  matchId: r.match_id,
  playerId: r.player_id,
  homeScore: r.home_score,
  awayScore: r.away_score,
  answer: r.answer,
  createdAt: r.created_at,
})

const MATCH_SELECT =
  '*, competition:competitions(name), season:seasons(name), home:teams!home_team_id(*), away:teams!away_team_id(*)'

// ---------------------------------------------------------------- helpers

type Result<T> = { data: T | null; error: { message: string; code?: string } | null }

/** Unwraps a Supabase response or throws an Error with a German message. */
async function ok<T>(query: PromiseLike<Result<T>>): Promise<T> {
  const { data, error } = await query
  if (error) throw new Error(friendlyError(error))
  return data as T
}

interface Loaded {
  seasonId: string
  seasonName: string
  players: Player[]
  matches: Match[]
  predictions: Prediction[]
  scores: Map<string, PredictionScore>
  leaderboard: LeaderboardEntry[]
  competitions: Competition[]
  teams: Team[]
  scoring: ScoringConfig
}

async function loadAll(supabase: SupabaseClient): Promise<Loaded> {
  const season = await ok<{ id: string; name: string } | null>(
    supabase.from('seasons').select('id, name').eq('is_current', true).maybeSingle(),
  )
  if (!season) throw new Error('Es ist keine aktuelle Saison eingetragen.')

  const [profiles, competitions, teams, scoring, matchRows, predictionRows, scoreRows, boardRows] =
    await Promise.all([
      ok<ProfileRow[]>(supabase.from('profiles').select('*')),
      ok<Competition[]>(supabase.from('competitions').select('id, name').order('name')),
      ok<TeamRow[]>(supabase.from('teams').select('*').order('name')),
      ok<ScoringRow>(supabase.from('scoring_config').select('*').single()),
      ok<MatchRow[]>(
        supabase.from('matches').select(MATCH_SELECT).eq('season_id', season.id).order('kickoff_at'),
      ),
      ok<PredictionRow[]>(supabase.from('predictions').select('*')),
      ok<ScoreRow[]>(supabase.from('prediction_scores').select('*')),
      ok<LeaderboardRow[]>(supabase.from('leaderboard').select('*').eq('season_id', season.id)),
    ])

  const players = profiles.map(toPlayer)
  const playerById = new Map(players.map((p) => [p.id, p]))
  const matches = matchRows.map(toMatch)
  const matchIds = new Set(matches.map((m) => m.id))

  const leaderboard = boardRows
    .filter((r) => playerById.has(r.player_id))
    .map<LeaderboardEntry>((r) => ({
      player: playerById.get(r.player_id)!,
      rank: r.rank,
      points: r.total_points,
      exactPredictions: r.exact_predictions,
      correctResults: r.correct_results,
      predictions: r.predictions,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.correctResults - a.correctResults ||
        a.player.displayName.localeCompare(b.player.displayName),
    )

  return {
    seasonId: season.id,
    seasonName: season.name,
    players,
    matches,
    predictions: predictionRows.filter((r) => matchIds.has(r.match_id)).map(toPrediction),
    scores: new Map(
      scoreRows.map((r) => [r.prediction_id, { points: r.points, isExact: r.is_exact, isCorrect: r.is_correct }]),
    ),
    leaderboard,
    competitions,
    teams: teams.map(toTeam),
    scoring: {
      exactScore: scoring.exact_score,
      goalDifference: scoring.goal_difference,
      correctResult: scoring.correct_result,
      correctAnswer: scoring.correct_answer,
    },
  }
}

/** Finds or creates teams by exact name; returns name -> id. */
async function resolveTeamIds(supabase: SupabaseClient, names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const existing = await ok<TeamRow[]>(supabase.from('teams').select('*').in('name', unique))
  const ids = new Map(existing.map((t) => [t.name, t.id]))
  const missing = unique.filter((n) => !ids.has(n))
  if (missing.length > 0) {
    const created = await ok<TeamRow[]>(
      supabase
        .from('teams')
        .insert(missing.map((name) => ({ name, short_name: shortNameFor(name) })))
        .select('*'),
    )
    created.forEach((t) => ids.set(t.name, t.id))
  }
  return ids
}

// ---------------------------------------------------------------- provider

export function SupabaseProvider({
  supabase,
  session,
  children,
}: {
  supabase: SupabaseClient
  session: Session
  children: ReactNode
}) {
  const uid = session.user.id
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await loadAll(supabase))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [supabase])

  useEffect(() => {
    // Fetching data on mount is a legitimate effect; load() sets state once the request resolves.
    // oxlint-disable-next-line react/set-state-in-effect
    void load()
    // Refresh when the user comes back to the tab (cheap "live" updates, no realtime needed).
    const onVisible = () => document.visibilityState === 'visible' && void load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const value = useMemo<DataValue | null>(() => {
    if (!data) return null
    const me = data.players.find((p) => p.id === uid)
    if (!me) return null

    const writing = async (fn: () => Promise<unknown>) => {
      await fn()
      await load()
    }

    const toColumns = (input: MatchInput, teamIds: Map<string, string>) => ({
      competition_id: input.competitionId,
      home_team_id: teamIds.get(input.homeTeamName.trim())!,
      away_team_id: teamIds.get(input.awayTeamName.trim())!,
      kickoff_at: input.kickoff,
      bet_type: input.betType,
      question: input.betType === 'yesno' ? input.question : null,
    })

    const admin: AdminApi = {
      createMatch: (input) =>
        writing(async () => {
          const teamIds = await resolveTeamIds(supabase, [input.homeTeamName, input.awayTeamName])
          await ok(supabase.from('matches').insert({ ...toColumns(input, teamIds), season_id: data.seasonId }))
        }),
      updateMatch: (id, input) =>
        writing(async () => {
          const teamIds = await resolveTeamIds(supabase, [input.homeTeamName, input.awayTeamName])
          await ok(supabase.from('matches').update(toColumns(input, teamIds)).eq('id', id))
        }),
      deleteMatch: (id) =>
        writing(async () => {
          const rows = await ok<{ id: string }[]>(supabase.from('matches').delete().eq('id', id).select('id'))
          if (rows.length === 0) throw new Error('Das Spiel konnte nicht gelöscht werden.')
        }),
      finalizeMatch: (id, result) =>
        writing(async () => {
          // The database trigger computes prediction_scores from this update.
          const rows = await ok<{ id: string }[]>(
            supabase
              .from('matches')
              .update({
                status: 'finished',
                home_score: result.homeScore,
                away_score: result.awayScore,
                answer: result.answer,
              })
              .eq('id', id)
              .select('id'),
          )
          if (rows.length === 0) throw new Error('Das Ergebnis konnte nicht gespeichert werden.')
        }),
      importMatches: async (rows, options) => {
        const teamIds = await resolveTeamIds(supabase, rows.flatMap((r) => [r.homeTeam, r.awayTeam]))
        const inserted = await ok<{ id: string }[]>(
          supabase
            .from('matches')
            .upsert(
              rows.map((r) => ({
                competition_id: options.competitionId,
                season_id: data.seasonId,
                home_team_id: teamIds.get(r.homeTeam.trim())!,
                away_team_id: teamIds.get(r.awayTeam.trim())!,
                kickoff_at: r.kickoff,
                bet_type: options.betType,
                question: options.betType === 'yesno' ? options.question : null,
              })),
              { onConflict: 'competition_id,season_id,home_team_id,away_team_id,kickoff_at', ignoreDuplicates: true },
            )
            .select('id'),
        )
        await load()
        return { imported: inserted.length, skipped: rows.length - inserted.length }
      },
      updateScoring: (config) =>
        writing(async () => {
          const rows = await ok<{ id: boolean }[]>(
            supabase
              .from('scoring_config')
              .update({
                exact_score: config.exactScore,
                goal_difference: config.goalDifference,
                correct_result: config.correctResult,
                correct_answer: config.correctAnswer,
              })
              .eq('id', true)
              .select('id'),
          )
          if (rows.length === 0) throw new Error('Die Punkte konnten nicht gespeichert werden.')
        }),
    }

    return {
      isDemo: false,
      me,
      seasonName: data.seasonName,
      matches: data.matches,
      players: data.players,
      predictions: data.predictions,
      leaderboard: data.leaderboard,
      competitions: data.competitions,
      teams: data.teams,
      scoring: data.scoring,
      scoreOf: (predictionId) => data.scores.get(predictionId) ?? null,
      savePrediction: (matchId, bet) =>
        writing(async () => {
          const existing = data.predictions.find((p) => p.matchId === matchId && p.playerId === uid)
          if (existing) {
            // Not an upsert: clients may only update the pick columns, not match_id/player_id.
            const rows = await ok<{ id: string }[]>(
              supabase
                .from('predictions')
                .update({ home_score: bet.homeScore, away_score: bet.awayScore, answer: bet.answer })
                .eq('id', existing.id)
                .select('id'),
            )
            if (rows.length === 0) throw new Error('Die Tippabgabe ist bereits geschlossen.')
          } else {
            await ok(
              supabase.from('predictions').insert({
                match_id: matchId,
                player_id: uid,
                home_score: bet.homeScore,
                away_score: bet.awayScore,
                answer: bet.answer,
              }),
            )
          }
        }),
      updateProfile: (displayName, avatar) =>
        writing(async () => {
          await ok(supabase.from('profiles').update({ display_name: displayName, avatar }).eq('id', uid))
        }),
      changePassword: async (password) => {
        const { error: err } = await supabase.auth.updateUser({ password })
        if (err) throw new Error(friendlyError(err))
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
      admin: me.isAdmin ? admin : null,
    }
  }, [data, load, supabase, uid])

  if (value) return <DataContext.Provider value={value}>{children}</DataContext.Provider>

  const message = error ?? (data ? 'Dein Profil wurde nicht gefunden. Bitte melde dich beim Admin.' : null)

  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      {message ? (
        <div className="card max-w-sm space-y-3">
          <p className="font-semibold">Daten konnten nicht geladen werden</p>
          <p className="text-sm text-white/60">{message}</p>
          <button className="btn-primary w-full" onClick={() => void load()}>
            Nochmal versuchen
          </button>
          <button className="btn-ghost w-full" onClick={() => void supabase.auth.signOut()}>
            Abmelden
          </button>
        </div>
      ) : (
        <p className="animate-pulse text-white/60">Lade …</p>
      )}
    </div>
  )
}
