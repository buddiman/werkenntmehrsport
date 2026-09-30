/**
 * Scoring rules. Pure functions, no I/O, so the same logic can later be
 * mirrored by a SQL function that runs when an admin finalizes a match.
 *
 * Every match has exactly ONE bet type:
 *  - 'score': predict the final score. The tiers are mutually exclusive and the
 *    highest one applies: exact score > correct goal difference > correct result (1/X/2).
 *  - 'yesno': answer a Yes/No question (e.g. "Over 2.5 goals?").
 */

export type BetType = 'score' | 'yesno'

export interface ScoringConfig {
  exactScore: number
  goalDifference: number
  correctResult: number
  correctAnswer: number
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  exactScore: 3,
  goalDifference: 2,
  correctResult: 2,
  correctAnswer: 2,
}

/** A prediction or an actual result. Only the fields of the match's bet type are used. */
export interface Bet {
  homeScore: number | null
  awayScore: number | null
  answer: boolean | null
}

export interface ScoreBreakdown {
  points: number
  exact: boolean
  correctDifference: boolean
  correctResult: boolean
  correctAnswer: boolean
}

export type Outcome = '1' | 'X' | '2'

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
  const none = {
    points: 0,
    exact: false,
    correctDifference: false,
    correctResult: false,
    correctAnswer: false,
  }

  if (betType === 'yesno') {
    const correctAnswer = prediction.answer !== null && prediction.answer === result.answer
    return { ...none, correctAnswer, points: correctAnswer ? config.correctAnswer : 0 }
  }

  const { homeScore: ph, awayScore: pa } = prediction
  const { homeScore: rh, awayScore: ra } = result
  if (ph === null || pa === null || rh === null || ra === null) return none

  const exact = ph === rh && pa === ra
  const correctDifference = ph - pa === rh - ra
  const correctResult = outcomeOf(ph, pa) === outcomeOf(rh, ra)

  let points = 0
  if (exact) points = config.exactScore
  else if (correctDifference) points = config.goalDifference
  else if (correctResult) points = config.correctResult

  return { ...none, points, exact, correctDifference, correctResult }
}
