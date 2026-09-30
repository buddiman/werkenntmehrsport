import type { Match, MatchStatus } from '../types/domain'

/**
 * Status as users should see it. A match whose prediction deadline has passed
 * is locked even if nobody has flipped the stored status yet. This is UI
 * convenience only; the real lock is enforced by the database (RLS).
 */
export function effectiveStatus(match: Match, now: number = Date.now()): MatchStatus {
  if (match.status === 'finished') return 'finished'
  if (match.status === 'locked' || now >= new Date(match.predictionDeadline).getTime()) {
    return 'locked'
  }
  return 'upcoming'
}
