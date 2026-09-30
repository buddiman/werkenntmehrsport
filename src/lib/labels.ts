import type { Match, Prediction } from '../types/domain'

/** "2:1" for score bets, "Ja"/"Nein" for Yes/No bets. */
export function pickLabel(p: Prediction) {
  return p.answer !== null ? (p.answer ? 'Ja' : 'Nein') : `${p.homeScore}:${p.awayScore}`
}

export function resultLabel(m: Match) {
  return m.betType === 'yesno' ? (m.answer ? 'Ja' : 'Nein') : `${m.homeScore}:${m.awayScore}`
}
