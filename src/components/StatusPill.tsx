import type { MatchStatus } from '../types/domain'
import { Icon } from './Icon'

const STYLES: Record<MatchStatus, string> = {
  upcoming: 'bg-lime-brand/15 text-lime-brand',
  locked: 'bg-amber-400/15 text-amber-300',
  finished: 'bg-white/10 text-white/70',
}
const LABELS: Record<MatchStatus, string> = {
  upcoming: 'Offen',
  locked: 'Gesperrt',
  finished: 'Beendet',
}

export function StatusPill({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STYLES[status]}`}
    >
      {status === 'locked' && <Icon name="lock" className="size-3" />}
      {LABELS[status]}
    </span>
  )
}
