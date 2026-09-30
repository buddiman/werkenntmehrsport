import { PageHeader } from '../components/PageHeader'
import { useData } from '../data/context'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function LeaderboardPage() {
  const { leaderboard, me, seasonName } = useData()

  return (
    <>
      <PageHeader title="Tabelle" subtitle={`Saison ${seasonName}`} />
      <div className="card overflow-hidden !p-0">
        <div className="grid grid-cols-[2.25rem_1fr_2.75rem_2.75rem_3rem_3rem] items-center gap-1 border-b border-white/10 px-3 py-2">
          <span className="label">#</span>
          <span className="label">Spieler</span>
          <span className="label text-center" title="Gewertete Tipps">Tipps</span>
          <span className="label text-center" title="Richtige Tendenzen / Antworten">Tend.</span>
          <span className="label text-center" title="Exakte Ergebnisse">Exakt</span>
          <span className="label text-right">Pkt</span>
        </div>
        <ol>
          {leaderboard.map((row) => {
            const isMe = row.player.id === me.id
            return (
              <li
                key={row.player.id}
                className={`grid grid-cols-[2.25rem_1fr_2.75rem_2.75rem_3rem_3rem] items-center gap-1 px-3 py-3 ${
                  isMe ? 'bg-lime-brand/10' : 'odd:bg-white/[0.02]'
                }`}
              >
                <span className="font-display text-xl font-extrabold">{MEDAL[row.rank] ?? row.rank}</span>
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="text-lg">{row.player.avatar}</span>
                  <span className="truncate">{row.player.displayName}</span>
                </span>
                <span className="text-center text-sm text-white/70">{row.predictions}</span>
                <span className="text-center text-sm text-white/70">{row.correctResults}</span>
                <span className="text-center text-sm text-white/70">{row.exactPredictions}</span>
                <span className="text-right font-display text-2xl font-extrabold text-lime-brand">{row.points}</span>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-3 text-xs text-white/40">
        Tipps = gewertete Tipps · Tend. = richtige Tendenz (1/X/2) bzw. Ja/Nein-Antwort · Exakt = exaktes Ergebnis. Bei Punktgleichheit entscheiden die exakten Tipps.
      </p>
    </>
  )
}
