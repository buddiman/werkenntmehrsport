import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { useData, type AdminApi } from '../data/context'
import { formatKickoff, toLocalInput } from '../lib/format'
import { importParsers } from '../lib/import'
import { BET_TYPE_LABELS } from '../lib/labels'
import { effectiveStatus } from '../lib/matchStatus'
import type { BetType, Outcome, ScoringConfig } from '../lib/scoring'
import { useTask } from '../lib/useTask'
import { isHttpUrl, linkLabel } from '../lib/url'
import type { Match } from '../types/domain'

type Tab = 'matches' | 'import' | 'scoring'
const TAB_LABELS: Record<Tab, string> = { matches: 'Spiele', import: 'Import', scoring: 'Punkte' }

const SCORING_LABELS: Record<keyof ScoringConfig, string> = {
  exactScore: 'Ergebnis-Tipp: exaktes Ergebnis',
  goalDifference: 'Ergebnis-Tipp: richtige Tordifferenz',
  correctTendency: 'Ergebnis-Tipp: richtige Tendenz',
  correctOutcome: '1X2-Tipp: richtiger Tipp',
  correctWinner: 'Sieger-Tipp: richtiger Tipp',
  correctAnswer: 'Ja/Nein-Frage: richtige Antwort',
}
const SCORING_KEYS = Object.keys(SCORING_LABELS) as (keyof ScoringConfig)[]
const BET_TYPES = Object.keys(BET_TYPE_LABELS) as BetType[]

const inputClass = 'w-full rounded-xl bg-pitch-950 p-3 ring-1 ring-white/15 focus:outline-lime-brand'

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null
  return <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{message}</p>
}

export function AdminPage() {
  const { me, admin } = useData()
  const [tab, setTab] = useState<Tab>('matches')

  // UI guard only. Real authorization is enforced by Supabase RLS.
  if (!me.isAdmin) return <Navigate to="/" replace />

  return (
    <>
      <PageHeader title="Admin" subtitle="Spiele, Ergebnisse und Punkte verwalten." />
      {!admin ? (
        <p className="card text-center text-white/60">
          Im Demo-Modus nicht verfügbar. Trage die Supabase-Zugangsdaten in <code>.env.local</code> ein.
        </p>
      ) : (
        <>
          <div className="mb-4 flex gap-1 rounded-xl bg-white/5 p-1">
            {(['matches', 'import', 'scoring'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold ${
                  tab === t ? 'bg-lime-brand text-pitch-950' : 'text-white/70'
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          {tab === 'matches' && <MatchesTab admin={admin} />}
          {tab === 'import' && <ImportTab admin={admin} />}
          {tab === 'scoring' && <ScoringTab admin={admin} />}
        </>
      )}
    </>
  )
}

// ---------------------------------------------------------------- matches

function MatchesTab({ admin }: { admin: AdminApi }) {
  const { matches } = useData()
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const sorted = [...matches].sort((a, b) => b.kickoff.localeCompare(a.kickoff))

  return (
    <div className="space-y-3">
      {editing === null && (
        <button className="btn-primary w-full" onClick={() => setEditing('new')}>
          + Neues Spiel
        </button>
      )}
      {editing === 'new' && <MatchForm admin={admin} onDone={() => setEditing(null)} />}
      {sorted.map((m) =>
        editing === m.id ? (
          <MatchForm key={m.id} admin={admin} match={m} onDone={() => setEditing(null)} />
        ) : (
          <MatchRow key={m.id} admin={admin} match={m} onEdit={() => setEditing(m.id)} />
        ),
      )}
      {matches.length === 0 && <p className="card text-center text-white/60">Noch keine Spiele.</p>}
    </div>
  )
}

function MatchRow({ admin, match: m, onEdit }: { admin: AdminApi; match: Match; onEdit: () => void }) {
  const status = effectiveStatus(m)
  const { busy, error, run } = useTask()
  const [home, setHome] = useState(m.homeScore?.toString() ?? '')
  const [away, setAway] = useState(m.awayScore?.toString() ?? '')
  const [answer, setAnswer] = useState(m.answer === null ? '' : String(m.answer))
  const [pick, setPick] = useState<string>(m.outcome ?? '')

  const isYesNo = m.betType === 'yesno'
  const isPick = m.betType === 'outcome' || m.betType === 'winner'
  const num = (v: string) => (/^\d{1,2}$/.test(v) ? Number(v) : null)
  const complete = isYesNo ? answer !== '' : isPick ? pick !== '' : num(home) !== null && num(away) !== null

  return (
    <div className="card !p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {m.homeTeam.name} – {m.awayTeam.name}
          </div>
          <div className="text-xs text-white/50">
            {formatKickoff(m.kickoff)}
            {` · ${BET_TYPE_LABELS[m.betType]}`}
            {isYesNo && ` · ❓ ${m.question}`}
          </div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isPick ? (
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Ergebnis"
            className="rounded-lg bg-pitch-950 px-3 py-1.5 font-bold ring-1 ring-white/15"
          >
            <option value="">Ergebnis …</option>
            <option value="1">1 (Heim)</option>
            {m.betType === 'outcome' && <option value="X">X (Unentschieden)</option>}
            <option value="2">2 (Gast)</option>
          </select>
        ) : isYesNo ? (
          <select
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-label="Antwort"
            className="rounded-lg bg-pitch-950 px-3 py-1.5 font-bold ring-1 ring-white/15"
          >
            <option value="">Antwort …</option>
            <option value="true">Ja</option>
            <option value="false">Nein</option>
          </select>
        ) : (
          <>
            <input
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              aria-label="Tore Heim"
              className="w-14 rounded-lg bg-pitch-950 py-1.5 text-center font-bold ring-1 ring-white/15"
            />
            <span className="text-white/40">:</span>
            <input
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              aria-label="Tore Gast"
              className="w-14 rounded-lg bg-pitch-950 py-1.5 text-center font-bold ring-1 ring-white/15"
            />
          </>
        )}
        <button
          className="btn-primary !py-1.5"
          disabled={busy || !complete}
          onClick={() =>
            run(() =>
              admin.finalizeMatch(m.id, {
                homeScore: m.betType === 'score' ? num(home) : null,
                awayScore: m.betType === 'score' ? num(away) : null,
                answer: isYesNo ? answer === 'true' : null,
                outcome: isPick ? (pick as Outcome) : null,
              }),
            )
          }
        >
          {m.status === 'finished' ? 'Korrigieren' : 'Abschließen'}
        </button>
        <div className="ml-auto flex gap-2">
          <button className="btn-ghost !py-1.5" disabled={busy} onClick={onEdit}>
            Bearbeiten
          </button>
          <button
            className="btn-ghost !py-1.5"
            disabled={busy}
            onClick={() => {
              if (window.confirm('Spiel wirklich löschen? Alle Tipps dazu gehen verloren.')) {
                void run(() => admin.deleteMatch(m.id))
              }
            }}
          >
            Löschen
          </button>
        </div>
      </div>
      <div className="mt-2">
        <ErrorLine message={error} />
      </div>
    </div>
  )
}

function MatchForm({ admin, match, onDone }: { admin: AdminApi; match?: Match; onDone: () => void }) {
  const { competitions, teams } = useData()
  const { busy, error, run } = useTask()
  const [competitionId, setCompetitionId] = useState(match?.competitionId ?? competitions[0]?.id ?? '')
  const [home, setHome] = useState(match?.homeTeam.name ?? '')
  const [away, setAway] = useState(match?.awayTeam.name ?? '')
  const [kickoff, setKickoff] = useState(match ? toLocalInput(match.kickoff) : '')
  const [betType, setBetType] = useState<BetType>(match?.betType ?? 'score')
  const [question, setQuestion] = useState(match?.question ?? '')
  const [infoUrl, setInfoUrl] = useState(match?.infoUrl ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const input = {
      infoUrl: infoUrl.trim() || null,
      competitionId,
      homeTeamName: home.trim(),
      awayTeamName: away.trim(),
      kickoff: new Date(kickoff).toISOString(),
      betType,
      question: betType === 'yesno' ? question.trim() : null,
    }
    const done = await run(async () => {
      if (input.infoUrl && !isHttpUrl(input.infoUrl)) {
        throw new Error('Der Link muss mit http:// oder https:// beginnen.')
      }
      if (match) await admin.updateMatch(match.id, input)
      else await admin.createMatch(input)
      return true
    })
    if (done) onDone()
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="font-semibold">{match ? 'Spiel bearbeiten' : 'Neues Spiel'}</h3>
      <datalist id="team-names">
        {teams.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>
      <select value={competitionId} onChange={(e) => setCompetitionId(e.target.value)} className={inputClass} required>
        {competitions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input list="team-names" value={home} onChange={(e) => setHome(e.target.value)} placeholder="Heim" required className={inputClass} />
        <input list="team-names" value={away} onChange={(e) => setAway(e.target.value)} placeholder="Gast" required className={inputClass} />
      </div>
      <label className="block">
        <span className="label">Anpfiff (= Tippschluss)</span>
        <input type="datetime-local" value={kickoff} onChange={(e) => setKickoff(e.target.value)} required className={`${inputClass} mt-1`} />
      </label>
      <select value={betType} onChange={(e) => setBetType(e.target.value as BetType)} className={inputClass}>
        {BET_TYPES.map((t) => (
          <option key={t} value={t}>
            {BET_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      {betType === 'yesno' && (
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="z. B. Gibt es eine rote Karte?" required className={inputClass} />
      )}
      <input
        type="url"
        value={infoUrl}
        onChange={(e) => setInfoUrl(e.target.value)}
        placeholder="Link zu Statistiken, z. B. Kicker (optional)"
        className={inputClass}
      />
      <ErrorLine message={error} />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          Speichern
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- import

function ImportTab({ admin }: { admin: AdminApi }) {
  const { competitions } = useData()
  const { busy, error, run } = useTask()
  const [parserId, setParserId] = useState(importParsers[0].id)
  const parser = importParsers.find((p) => p.id === parserId)!
  const [text, setText] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const result = parser.parse(text)
  const knownLeague = (name: string) => competitions.some((c) => c.name.toLowerCase() === name.toLowerCase())

  async function copyInstructions() {
    try {
      await navigator.clipboard.writeText(parser.instructions)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the text is selectable in the box anyway.
    }
  }

  async function doImport() {
    setMessage(null)
    const r = await run(() =>
      admin.importMatches(
        // The pasted local time is interpreted in this browser's timezone.
        result.matches.map((m) => ({ ...m, kickoff: new Date(m.kickoff).toISOString() })),
      ),
    )
    if (r) {
      const parts = [`${r.imported} importiert`]
      if (r.skipped > 0) parts.push(`${r.skipped} gab es schon`)
      if (r.newCompetitions > 0) parts.push(`${r.newCompetitions} neue Liga angelegt`)
      setMessage(`${parts.join(', ')}.`)
      setText('')
    }
  }

  return (
    <div className="space-y-3">
      {importParsers.length > 1 && (
        <select value={parserId} onChange={(e) => setParserId(e.target.value)} className={inputClass}>
          {importParsers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}

      <details open className="card !p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="label">Anleitung für eine KI (Spielliste erstellen lassen)</span>
          <button
            type="button"
            className="btn-ghost !px-3 !py-1 text-xs"
            onClick={(e) => {
              e.preventDefault()
              void copyInstructions()
            }}
          >
            {copied ? 'Kopiert ✓' : 'Kopieren'}
          </button>
        </summary>
        <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/70">
          {parser.instructions}
        </pre>
      </details>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        spellCheck={false}
        placeholder={parser.example}
        className="w-full rounded-xl bg-pitch-950 p-3 font-mono text-sm ring-1 ring-white/15 focus:outline-lime-brand"
      />
      <p className="text-xs text-white/50">
        Die Uhrzeit gilt in der Zeitzone deines Browsers. Unbekannte Ligen werden neu angelegt. Spiele, die es schon
        gibt, werden übersprungen (Link und Tipp-Art bleiben unverändert).
      </p>

      <div className="card space-y-3">
        <h3 className="label">Vorschau · {result.matches.length} gültig</h3>
        {result.matches.map((m, i) => (
          <div key={i} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="truncate font-semibold">
                {m.homeTeam} – {m.awayTeam}
              </span>
              <span className="shrink-0 text-white/50">{m.kickoff.replace('T', ' ')}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  knownLeague(m.competition) ? 'bg-white/10 text-white/70' : 'bg-amber-400/15 text-amber-300'
                }`}
              >
                {m.competition}
                {!knownLeague(m.competition) && ' (neu)'}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">{BET_TYPE_LABELS[m.betType]}</span>
              {m.question && <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/70">❓ {m.question}</span>}
              {m.infoUrl && <span className="rounded-full bg-white/10 px-2 py-0.5 text-lime-brand">📊 {linkLabel(m.infoUrl)}</span>}
            </div>
          </div>
        ))}
        {result.errors.map((e) => (
          <div key={e.line} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            Zeile {e.line}: {e.message}
          </div>
        ))}
      </div>
      <ErrorLine message={error} />
      {message && <p className="rounded-lg bg-lime-brand/10 px-3 py-2 text-sm text-lime-brand">{message}</p>}
      <button
        className="btn-primary w-full"
        disabled={busy || result.matches.length === 0 || result.errors.length > 0}
        onClick={() => void doImport()}
      >
        {result.matches.length} Spiele importieren
      </button>
      {result.errors.length > 0 && (
        <p className="text-center text-xs text-red-300">Bitte erst die fehlerhaften Zeilen korrigieren.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- scoring

function ScoringTab({ admin }: { admin: AdminApi }) {
  const { scoring } = useData()
  const { busy, error, run } = useTask()
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(SCORING_KEYS.map((k) => [k, String(scoring[k])])),
  )
  const [saved, setSaved] = useState(false)
  const valid = SCORING_KEYS.every((k) => /^\d{1,3}$/.test(values[k]))

  async function save() {
    setSaved(false)
    const ok = await run(async () => {
      const next = { ...scoring }
      for (const k of SCORING_KEYS) next[k] = Number(values[k])
      await admin.updateScoring(next)
      return true
    })
    if (ok) setSaved(true)
  }

  return (
    <div className="card space-y-3">
      {SCORING_KEYS.map((key) => (
        <label key={key} className="flex items-center justify-between gap-3">
          <span className="text-sm">{SCORING_LABELS[key]}</span>
          <input
            inputMode="numeric"
            value={values[key]}
            onChange={(e) => {
              setSaved(false)
              setValues({ ...values, [key]: e.target.value })
            }}
            className="w-16 shrink-0 rounded-lg bg-pitch-950 py-1.5 text-center font-display text-2xl font-extrabold text-lime-brand ring-1 ring-white/15"
          />
        </label>
      ))}
      <p className="text-xs text-white/50">
        Beim Speichern werden die Punkte aller beendeten Spiele neu berechnet.
      </p>
      <ErrorLine message={error} />
      {saved && <p className="rounded-lg bg-lime-brand/10 px-3 py-2 text-sm text-lime-brand">Gespeichert.</p>}
      <button className="btn-primary w-full" disabled={busy || !valid} onClick={() => void save()}>
        Speichern
      </button>
    </div>
  )
}
