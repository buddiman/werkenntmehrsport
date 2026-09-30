import type { SupabaseClient } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'

export function LoginPage({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await client.auth.signInWithPassword({ email: email.trim(), password })
    if (err) setError('E-Mail oder Passwort stimmt nicht.')
    setBusy(false)
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-sm place-items-center px-4">
      <form onSubmit={submit} className="card w-full space-y-4">
        <div className="text-center">
          <div className="text-5xl">⚽</div>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-none">
            Wer kennt <span className="text-lime-brand">mehr Sport?</span>
          </h1>
          <p className="mt-2 text-sm text-white/60">Melde dich mit deinem Zugang an.</p>
        </div>

        <label className="block">
          <span className="label">E-Mail</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl bg-pitch-950 p-3 ring-1 ring-white/15 focus:outline-lime-brand"
          />
        </label>
        <label className="block">
          <span className="label">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl bg-pitch-950 p-3 ring-1 ring-white/15 focus:outline-lime-brand"
          />
        </label>

        {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
        <p className="text-center text-xs text-white/40">
          Noch keinen Zugang? Frag den Admin. Passwort vergessen? Der Admin kann es zurücksetzen.
        </p>
      </form>
    </div>
  )
}
