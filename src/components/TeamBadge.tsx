import type { Team } from '../types/domain'

// Stable colour per team, derived from the id, until real crests exist.
function hue(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360
  return h
}

export function TeamBadge({ team, size = 'md' }: { team: Team; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'size-8 text-[10px]' : 'size-12 text-xs'
  return (
    <div
      className={`${dim} grid shrink-0 place-items-center rounded-full font-display font-bold tracking-wide text-white ring-2 ring-white/20`}
      style={{ background: `linear-gradient(135deg, hsl(${hue(team.id)} 65% 42%), hsl(${hue(team.id)} 60% 26%))` }}
    >
      {team.shortName}
    </div>
  )
}
