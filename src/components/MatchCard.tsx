import { useState } from 'react'
import { formatKickoff, timeLeft } from '../lib/format'
import { BET_TYPE_LABELS, pickLabel, pointsHint, resultLabel } from '../lib/labels'
import type { Outcome as OutcomePick } from '../lib/scoring'
import { linkLabel } from '../lib/url'
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

const PICK_CAPTION = { '1': 'Heimsieg', X: 'Unentschieden', '2': 'Auswärtssieg' } as const

function PredictionForm({ match, existing }: { match: Match; existing?: Prediction }) {
  const { savePrediction, scoring } = useData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [home, setHome] = useState(existing?.homeScore ?? 1)
  const [away, setAway] = useState(existing?.awayScore ?? 1)
  const [answer, setAnswer] = useState<boolean | null>(existing?.answer ?? null)
  const [pick, setPick] = useState<OutcomePick | null>(existing?.outcome ?? null)
  const [saved, setSaved] = useState(false)
  const type = match.betType
  const isPick = type === 'outcome' || type === 'winner'

  const touch = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setSaved(false)
  }

  const missingChoice = (type === 'yesno' && answer === null) || (isPick && pick === null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await savePrediction(match.id, {
        homeScore: type === 'score' ? home : null,
        awayScore: type === 'score' ? away : null,
        answer: type === 'yesno' ? answer : null,
        outcome: isPick ? pick : null,
      })
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const bigButton = (active: boolean) =>
    `rounded-xl py-4 font-display text-3xl font-extrabold uppercase transition active:scale-95 ${
      active ? 'bg-lime-brand text-pitch-950' : 'bg-white/10 text-white/80'
    }`

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {type === 'score' && (
        <div className="flex items-center justify-center gap-5">
          <ScoreStepper value={home} onChange={touch(setHome)} label={`${match.homeTeam.name} Tore`} />
          <span className="font-display text-3xl text-white/40">:</span>
          <ScoreStepper value={away} onChange={touch(setAway)} label={`${match.awayTeam.name} Tore`} />
        </div>
      )}

      {type === 'yesno' && (
        <div className="grid grid-cols-2 gap-3">
          {([true, false] as const).map((v) => (
            <button key={String(v)} type="button" onClick={() => touch(setAnswer)(v)} className={bigButton(answer === v)}>
              {v ? 'Ja' : 'Nein'}
            </button>
          ))}
        </div>
      )}

      {isPick && (
        <div className={`grid gap-3 ${type === 'outcome' ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {(type === 'outcome' ? (['1', 'X', '2'] as const) : (['1', '2'] as const)).map((v) => (
            <button key={v} type="button" onClick={() => touch(setPick)(v)} className={bigButton(pick === v)}>
              {v}
              <span className="block font-sans text-[11px] font-semibold normal-case tracking-normal opacity-70">
                {v === '1' ? match.homeTeam.shortName : v === '2' ? match.awayTeam.shortName : PICK_CAPTION.X}
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-xs text-white/40">{pointsHint(type, scoring)}</p>

      <button type="button" className="btn-primary mt-3 w-full" disabled={busy || missingChoice} onClick={() => void save()}>
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

      <p className="mb-3 text-center">
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
          {BET_TYPE_LABELS[match.betType]}
        </span>
      </p>

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

      {match.infoUrl && (
        <p className="mt-3 text-center">
          <a
            href={match.infoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-lime-brand underline-offset-2 hover:underline"
          >
            📊 Statistiken auf {linkLabel(match.infoUrl)} ↗
          </a>
        </p>
      )}

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
