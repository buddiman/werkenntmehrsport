/**
 * Scoring rules. Pure functions, no I/O. Mirrored in SQL by
 * private.recompute_match_scores() (supabase/migrations): change both together.
 *
 * Every match has exactly ONE bet type:
 *  - 'score'   predict the final score. The tiers are mutually exclusive, highest wins:
 *                exact score (3) > correct goal difference (2) > correct tendency (1)
 *              e.g. result 3:1: bet 3:1 = 3, bet 2:0 = 2 (same difference), bet 1:0 = 1 (same winner).
 *              A draw counts as a tendency: result 0:0, bet 1:1 = 2 (same difference).
 *  - 'outcome' 1X2 pick (home win / draw / away win): correct pick = 2
 *  - 'winner'  1 or 2 only (no draw): correct pick = 2
 *  - 'yesno'   Yes/No question with a free text: correct answer = 2
 */

export type BetType = 'score' | 'outcome' | 'winner' | 'yesno'
export type Outcome = '1' | 'X' | '2'

export interface ScoringConfig {
  exactScore: number
  goalDifference: number
  correctTendency: number
  correctOutcome: number
  correctWinner: number
  correctAnswer: number
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  exactScore: 3,
  goalDifference: 2,
  correctTendency: 1,
  correctOutcome: 2,
  correctWinner: 2,
  correctAnswer: 2,
}

/** A prediction or an actual result. Only the fields of the match's bet type are used. */
export interface Bet {
  homeScore: number | null
  awayScore: number | null
  answer: boolean | null
  outcome: Outcome | null
}

export interface ScoreBreakdown {
  points: number
  /** Exact score (score bets only). */
  exact: boolean
  /** Correct goal difference (score bets only; includes exact). */
  correctDifference: boolean
  /** Right tendency (score), right pick (1X2 / winner) or right answer (Yes/No). */
  correct: boolean
}

export function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return '1'
  if (home < away) return '2'
  return 'X'
}

export function scorePrediction(
  betType: BetType,
  prediction: Bet,
  result: Bet,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreBreakdown {
  const none: ScoreBreakdown = { points: 0, exact: false, correctDifference: false, correct: false }

  switch (betType) {
    case 'yesno': {
      const correct = prediction.answer !== null && prediction.answer === result.answer
      return { ...none, correct, points: correct ? config.correctAnswer : 0 }
    }
    case 'outcome':
    case 'winner': {
      const correct = prediction.outcome !== null && prediction.outcome === result.outcome
      const value = betType === 'outcome' ? config.correctOutcome : config.correctWinner
      return { ...none, correct, points: correct ? value : 0 }
    }
    case 'score': {
      const { homeScore: ph, awayScore: pa } = prediction
      const { homeScore: rh, awayScore: ra } = result
      if (ph === null || pa === null || rh === null || ra === null) return none

      const exact = ph === rh && pa === ra
      const correctDifference = ph - pa === rh - ra
      const correct = outcomeOf(ph, pa) === outcomeOf(rh, ra)

      let points = 0
      if (exact) points = config.exactScore
      else if (correctDifference) points = config.goalDifference
      else if (correct) points = config.correctTendency
      return { points, exact, correctDifference, correct }
    }
  }
}
