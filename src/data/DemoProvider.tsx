import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { buildLeaderboard, pointsFor } from '../lib/leaderboard'
import { DEFAULT_SCORING_CONFIG } from '../lib/scoring'
import {
  CURRENT_PLAYER_ID,
  initialPredictions,
  matches,
  players,
} from '../mock/data'
import type { Prediction } from '../types/domain'
import { DataContext, type DataValue } from './context'

/** In-memory data for running without a Supabase project. Nothing is persisted. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [predictions, setPredictions] = useState<Prediction[]>(initialPredictions)

  const savePrediction = useCallback<DataValue['savePrediction']>(async (matchId, bet) => {
    setPredictions((prev) => [
      ...prev.filter((p) => !(p.matchId === matchId && p.playerId === CURRENT_PLAYER_ID)),
      {
        id: `${matchId}-${CURRENT_PLAYER_ID}`,
        matchId,
        playerId: CURRENT_PLAYER_ID,
        ...bet,
        createdAt: new Date().toISOString(),
      },
    ])
  }, [])

  const value = useMemo<DataValue>(() => {
    const matchById = new Map(matches.map((m) => [m.id, m]))
    return {
      isDemo: true,
      me: players.find((p) => p.id === CURRENT_PLAYER_ID)!,
      seasonName: matches[0].season,
      matches,
      players,
      predictions,
      leaderboard: buildLeaderboard(players, matches, predictions),
      competitions: [{ id: matches[0].competitionId, name: matches[0].competition }],
      teams: [],
      scoring: DEFAULT_SCORING_CONFIG,
      scoreOf(predictionId) {
        const p = predictions.find((x) => x.id === predictionId)
        const match = p && matchById.get(p.matchId)
        const score = p && match ? pointsFor(p, match) : null
        return score
          ? {
              points: score.points,
              isExact: score.exact,
              isCorrect: score.correctResult || score.correctAnswer,
            }
          : null
      },
      savePrediction,
      updateProfile: async () => {
        throw new Error('Im Demo-Modus nicht verfügbar.')
      },
      changePassword: null,
      signOut: null,
      admin: null,
    }
  }, [predictions, savePrediction])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
