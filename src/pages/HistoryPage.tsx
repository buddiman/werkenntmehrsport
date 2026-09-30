import { PageHeader } from '../components/PageHeader'
import { TeamBadge } from '../components/TeamBadge'
import { formatKickoff } from '../lib/format'
import { pickLabel, resultLabel } from '../lib/labels'
import { useData } from '../data/context'

export function HistoryPage() {
  const { matches, predictions, players, me, scoreOf } = useData()
  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))

  return (
    <>
      <PageHeader title="Verlauf" subtitle="Beendete Spiele und die Tipps aller." />
      <div className="space-y-3">
        {finished.map((m) => {
          const picks = predictions
            .filter((p) => p.matchId === m.id)
            .map((p) => ({ p, player: players.find((pl) => pl.id === p.playerId), score: scoreOf(p.id) }))
            .flatMap((r) => (r.player && r.score ? [{ ...r, player: r.player, score: r.score }] : []))
            .sort((a, b) => b.score.points - a.score.points)
          return (
            <details key={m.id} className="card group !p-0">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <div className="flex -space-x-2">
                  <TeamBadge team={m.homeTeam} size="sm" />
                  <TeamBadge team={m.awayTeam} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {m.homeTeam.name} – {m.awayTeam.name}
                  </div>
                  <div className="text-xs text-white/50">{formatKickoff(m.kickoff)}</div>
                </div>
                <div className="font-display text-3xl font-extrabold uppercase">
                  {resultLabel(m)}
                </div>
              </summary>
              <ul className="divide-y divide-white/10 border-t border-white/10">
                {picks.map(({ p, player, score }) => (
                  <li
                    key={p.id}
                    className={`flex items-center gap-3 px-4 py-2 text-sm ${player.id === me.id ? 'bg-lime-brand/10' : ''}`}
                  >
                    <span>{player.avatar}</span>
                    <span className="flex-1">{player.displayName}</span>
                    <span className="font-bold">
                      {pickLabel(p)}
                    </span>
                    <span
                      className={`w-10 rounded-full py-0.5 text-center text-xs font-extrabold ${
                        score.points > 0 ? 'bg-lime-brand text-pitch-950' : 'bg-white/10 text-white/60'
                      }`}
                    >
                      {score.isExact ? '🎯' : '+'}
                      {score.points}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </div>
    </>
  )
}
