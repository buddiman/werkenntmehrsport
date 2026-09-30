import { Link } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { effectiveStatus } from '../lib/matchStatus'
import { useData } from '../data/context'

export function HomePage() {
  const { me, matches, leaderboard, predictions } = useData()
  const myRow = leaderboard.find((r) => r.player.id === me.id)
  const open = matches
    .filter((m) => effectiveStatus(m) === 'upcoming')
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
  const missing = open.filter((m) => !predictions.some((p) => p.matchId === m.id && p.playerId === me.id))
  const next = open[0]

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden bg-gradient-to-br from-pitch-700 to-pitch-900">
        <p className="label">Willkommen zurück</p>
        <h1 className="font-display text-5xl font-extrabold uppercase leading-none">
          {me.avatar} {me.displayName}
        </h1>
        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Platz" value={myRow ? `#${myRow.rank}` : '–'} accent />
          <Stat label="Punkte" value={myRow?.points ?? 0} />
          <Stat label="Exakt 🎯" value={myRow?.exactPredictions ?? 0} />
        </div>
      </section>

      {missing.length > 0 && (
        <Link
          to="/matches"
          className="flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm"
        >
          <span>
            <b className="text-amber-300">{missing.length} offene{missing.length > 1 ? '' : 's'} Spiel{missing.length > 1 ? 'e' : ''}</b>{' '}
            ohne deinen Tipp
          </span>
          <span className="font-bold text-amber-300">Jetzt tippen →</span>
        </Link>
      )}

      {next && (
        <section>
          <h2 className="label mb-2">Als Nächstes</h2>
          <MatchCard match={next} />
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="label">Top 3</h2>
          <Link to="/leaderboard" className="text-xs font-bold text-lime-brand">
            Ganze Tabelle
          </Link>
        </div>
        <ol className="card divide-y divide-white/10 p-0">
          {leaderboard.slice(0, 3).map((row) => (
            <li key={row.player.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 font-display text-2xl font-extrabold text-gold">{row.rank}</span>
              <span className="text-xl">{row.player.avatar}</span>
              <span className="flex-1 font-semibold">{row.player.displayName}</span>
              <span className="font-display text-2xl font-extrabold">{row.points}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-black/20 py-3">
      <div className={`font-display text-4xl font-extrabold ${accent ? 'text-lime-brand' : ''}`}>{value}</div>
      <div className="label">{label}</div>
    </div>
  )
}
