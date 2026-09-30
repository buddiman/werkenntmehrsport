import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { TeamBadge } from '../components/TeamBadge'
import { formatKickoff } from '../lib/format'
import { pickLabel, resultLabel } from '../lib/labels'
import { effectiveStatus } from '../lib/matchStatus'
import { useData } from '../data/context'

export function MyPredictionsPage() {
  const { matches, predictions, me, scoreOf } = useData()
  const mine = predictions
    .filter((p) => p.playerId === me.id)
    .map((p) => ({ p, match: matches.find((m) => m.id === p.matchId)! }))
    .sort((a, b) => b.match.kickoff.localeCompare(a.match.kickoff))

  return (
    <>
      <PageHeader title="Meine Tipps" subtitle={`${mine.length} Tipps in dieser Saison`} />
      {mine.length === 0 && (
        <p className="card text-center text-white/60">
          Noch nichts getippt. <Link to="/matches" className="font-bold text-lime-brand">Jetzt tippen →</Link>
        </p>
      )}
      <ul className="space-y-2">
        {mine.map(({ p, match }) => {
          const status = effectiveStatus(match)
          const score = status === 'finished' ? scoreOf(p.id) : null
          return (
            <li key={p.id} className="card flex items-center gap-3 !p-3">
              <div className="flex -space-x-2">
                <TeamBadge team={match.homeTeam} size="sm" />
                <TeamBadge team={match.awayTeam} size="sm" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {match.homeTeam.shortName} – {match.awayTeam.shortName}
                </div>
                <div className="text-xs text-white/50">{formatKickoff(match.kickoff)}</div>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-extrabold leading-none">
                  {pickLabel(p)}
                </div>
                {status === 'finished' ? (
                  <div className="text-[11px] text-white/50">
                    Endstand {resultLabel(match)}
                  </div>
                ) : (
                  <div className="text-[11px] text-white/50">{status === 'locked' ? '🔒 Gesperrt' : 'Offen'}</div>
                )}
              </div>
              {score && (
                <span
                  className={`w-10 rounded-full py-1 text-center text-xs font-extrabold ${
                    score.points > 0 ? 'bg-lime-brand text-pitch-950' : 'bg-white/10 text-white/60'
                  }`}
                >
                  +{score.points}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
