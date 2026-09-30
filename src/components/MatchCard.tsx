import { useState } from 'react'
import { formatKickoff, timeLeft } from '../lib/format'
import { pickLabel, resultLabel } from '../lib/labels'
import { effectiveStatus } from '../lib/matchStatus'
import { useData } from '../data/context'
import type { Match, Prediction } from '../types/domain'
import { Icon } from './Icon'
import { ScoreStepper } from './ScoreStepper'
import { StatusPill } from './StatusPill'
import { TeamBadge } from './TeamBadge'

function Team({ match, side }: { match: Match; side: 'home' | 'away' }) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <TeamBadge team={team} />
      <span className="line-clamp-2 text-sm font-semibold leading-tight">{team.name}</span>
    </div>
  )
}

function PredictionForm({ match, existing }: { match: Match; existing?: Prediction }) {
  const { savePrediction } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [home, setHome] = useState(existing?.homeScore ?? 1)
  const [away, setAway] = useState(existing?.awayScore ?? 1)
  const [answer, setAnswer] = useState<boolean | null>(existing?.answer ?? null)
  const [saved, setSaved] = useState(false)
  const isYesNo = match.betType === 'yesno'

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setSaved(false)
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {isYesNo ? (
        <div>
          <p className="mb-3 text-center font-semibold">
            <span className="mr-1">❓</span>
            {match.question}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => touch(setAnswer)(v)}
                className={`rounded-xl py-4 font-display text-3xl font-extrabold uppercase transition active:scale-95 ${
                  answer === v ? 'bg-lime-brand text-pitch-950' : 'bg-white/10 text-white/80'
                }`}
              >
                {v ? 'Ja' : 'Nein'}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-5">
          <ScoreStepper value={home} onChange={touch(setHome)} label={`${match.homeTeam.name} Tore`} />
          <span className="font-display text-3xl text-white/40">:</span>
          <ScoreStepper value={away} onChange={touch(setAway)} label={`${match.awayTeam.name} Tore`} />
        </div>
      )}

      <button
        type="button"
        className="btn-primary mt-4 w-full"
        disabled={busy || (isYesNo && answer === null)}
        onClick={async () => {
          setBusy(true)
          setError(null)
          try {
            await savePrediction(
              match.id,
              isYesNo
                ? { homeScore: null, awayScore: null, answer }
                : { homeScore: home, awayScore: away, answer: null },
            )
            setSaved(true)
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setBusy(false)
          }
        }}
      >
        {saved ? (
          <>
            <Icon name="check" className="size-4" /> Gespeichert
          </>
        ) : existing ? (
          'Tipp ändern'
        ) : (
          'Tipp abgeben'
        )}
      </button>
      {error && <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">{error}</p>}
    </div>
  )
}

function Outcome({ match, prediction }: { match: Match; prediction?: Prediction }) {
  const { scoreOf } = useData()
  const score = prediction && match.status === 'finished' ? scoreOf(prediction.id) : null
  return (
    <div className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm">
      {prediction ? (
        <span className="text-white/70">
          Dein Tipp <b className="text-white">{pickLabel(prediction)}</b>
        </span>
      ) : (
        <span className="text-white/50">Kein Tipp</span>
      )}
      {score && (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
            score.points > 0 ? 'bg-lime-brand text-pitch-950' : 'bg-white/10 text-white/60'
          }`}
        >
          {score.isExact ? '🎯 ' : ''}+{score.points}
        </span>
      )}
    </div>
  )
}

export function MatchCard({ match, editable = true }: { match: Match; editable?: boolean }) {
  const { predictions, me } = useData()
  const status = effectiveStatus(match)
  const mine = predictions.find((p) => p.matchId === match.id && p.playerId === me.id)

  return (
    <article className="card">
      <header className="mb-3 flex items-center justify-between text-xs text-white/60">
        <span>
          {match.competition} · {formatKickoff(match.kickoff)}
        </span>
        <StatusPill status={status} />
      </header>

      <div className="flex items-center gap-2">
        <Team match={match} side="home" />
        <div className="w-20 shrink-0 text-center font-display text-4xl font-extrabold">
          {status === 'finished' ? (
            resultLabel(match)
          ) : (
            <span className="text-2xl text-white/40">vs</span>
          )}
        </div>
        <Team match={match} side="away" />
      </div>

      {match.betType === 'yesno' && (
        <p className="mt-3 text-center text-xs font-semibold text-lime-brand">❓ {match.question}</p>
      )}

      {status === 'upcoming' && (
        <p className="mt-3 text-center text-xs text-amber-300/90">
          ⏱ Tippabgabe bis Anpfiff, noch {timeLeft(match.predictionDeadline)}
        </p>
      )}

      {status === 'upcoming' && editable ? (
        <PredictionForm key={mine?.id ?? 'new'} match={match} existing={mine} />
      ) : (
        <Outcome match={match} prediction={mine} />
      )}
    </article>
  )
}
