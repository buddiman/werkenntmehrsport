import type { BetType, ScoringConfig } from './scoring'
import type { Match, Prediction } from '../types/domain'

/** "2:1" for score bets, "Ja"/"Nein" for Yes/No bets. */
export function pickLabel(p: Prediction) {
  if (p.outcome !== null) return p.outcome
  if (p.answer !== null) return p.answer ? 'Ja' : 'Nein'
  return `${p.homeScore}:${p.awayScore}`
}

export function resultLabel(m: Match) {
  if (m.betType === 'yesno') return m.answer ? 'Ja' : 'Nein'
  if (m.betType === 'outcome' || m.betType === 'winner') return m.outcome ?? ''
  return `${m.homeScore}:${m.awayScore}`
}

export const BET_TYPE_LABELS: Record<BetType, string> = {
  score: 'Ergebnis-Tipp',
  outcome: '1X2-Tipp',
  winner: 'Sieger-Tipp',
  yesno: 'Ja/Nein-Frage',
}

/** One-line explanation of what a correct bet is worth, from the current scoring config. */
export function pointsHint(type: BetType, c: ScoringConfig): string {
  switch (type) {
    case 'score':
      return `Exakt ${c.exactScore} · Tordifferenz ${c.goalDifference} · Tendenz ${c.correctTendency} Punkte`
    case 'outcome':
      return `Richtiger Tipp: ${c.correctOutcome} Punkte`
    case 'winner':
      return `Richtiger Sieger: ${c.correctWinner} Punkte`
    case 'yesno':
      return `Richtige Antwort: ${c.correctAnswer} Punkte`
  }
}
