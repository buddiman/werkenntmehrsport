import type { LeaderboardEntry, Match, Player, Prediction } from '../types/domain'
import { DEFAULT_SCORING_CONFIG, scorePrediction, type ScoringConfig } from './scoring'

/** Points a single prediction earned, or null if the match has no result yet. */
export function pointsFor(
  prediction: Prediction,
  match: Match,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
) {
  if (match.status !== 'finished') return null
  return scorePrediction(match.betType, prediction, match, config)
}

/**
 * Builds the leaderboard client-side from mock data. In production this will
 * be a Postgres view, so ranking is computed once, in the database.
 */
export function buildLeaderboard(
  players: Player[],
  matches: Match[],
  predictions: Prediction[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): LeaderboardEntry[] {
  const matchById = new Map(matches.map((m) => [m.id, m]))

  const rows = players.map((player) => {
    let points = 0
    let exactPredictions = 0
    let correctResults = 0
    let count = 0
    for (const p of predictions) {
      if (p.playerId !== player.id) continue
      const match = matchById.get(p.matchId)
      if (!match) continue
      const score = pointsFor(p, match, config)
      if (!score) continue
      count += 1
      points += score.points
      if (score.exact) exactPredictions += 1
      // "Correct results" counts right tendencies, picks and answers.
      if (score.correct) correctResults += 1
    }
    return { player, points, exactPredictions, correctResults, predictions: count }
  })

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.exactPredictions - a.exactPredictions ||
      b.correctResults - a.correctResults ||
      a.player.displayName.localeCompare(b.player.displayName),
  )

  // Standard competition ranking: players equal on points + exact share a rank.
  const ranked: LeaderboardEntry[] = []
  rows.forEach((row, i) => {
    const prev = ranked[i - 1]
    const tied =
      prev && prev.points === row.points && prev.exactPredictions === row.exactPredictions
    ranked.push({ ...row, rank: tied ? prev.rank : i + 1 })
  })
  return ranked
}
