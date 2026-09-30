import { useState, type FormEvent } from 'react'
import { useData } from '../data/context'
import { PageHeader } from '../components/PageHeader'

const AVATARS = ['🦊', '🐯', '🦁', '🐼', '🐸', '🦄', '🐙', '🐵', '🦉', '🐺', '🐧', '🦈', '⚽', '🏆']

type Notice = { kind: 'ok' | 'error'; text: string } | null

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        notice.kind === 'ok' ? 'bg-lime-brand/10 text-lime-brand' : 'bg-red-500/10 text-red-300'
      }`}
    >
      {notice.text}
    </p>
  )
}

export function ProfilePage() {
  const { me, updateProfile, changePassword, signOut, isDemo } = useData()
  const [name, setName] = useState(me.displayName)
  const [avatar, setAvatar] = useState(me.avatar)
  const [profileNotice, setProfileNotice] = useState<Notice>(null)
  const [password, setPassword] = useState('')
  const [passwordNotice, setPasswordNotice] = useState<Notice>(null)

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    try {
      await updateProfile(name.trim(), avatar)
      setProfileNotice({ kind: 'ok', text: 'Gespeichert.' })
    } catch (err) {
      setProfileNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (!changePassword) return
    try {
      await changePassword(password)
      setPassword('')
      setPasswordNotice({ kind: 'ok', text: 'Passwort geändert.' })
    } catch (err) {
      setPasswordNotice({ kind: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <>
      <PageHeader title="Profil" subtitle={isDemo ? 'Demo-Modus' : undefined} />
      <div className="space-y-4">
        <form onSubmit={saveProfile} className="card space-y-4">
          <label className="block">
            <span className="label">Anzeigename</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              required
              className="mt-1 w-full rounded-xl bg-pitch-950 p-3 ring-1 ring-white/15 focus:outline-lime-brand"
            />
          </label>
          <div>
            <span className="label">Avatar</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`grid size-11 place-items-center rounded-xl text-2xl ${
                    avatar === a ? 'bg-lime-brand/20 ring-2 ring-lime-brand' : 'bg-white/5'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <NoticeBox notice={profileNotice} />
          <button type="submit" className="btn-primary w-full">
            Speichern
          </button>
        </form>

        {changePassword && (
          <form onSubmit={savePassword} className="card space-y-4">
            <label className="block">
              <span className="label">Neues Passwort (mind. 8 Zeichen)</span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl bg-pitch-950 p-3 ring-1 ring-white/15 focus:outline-lime-brand"
              />
            </label>
            <NoticeBox notice={passwordNotice} />
            <button type="submit" className="btn-ghost w-full">
              Passwort ändern
            </button>
          </form>
        )}

        {signOut && (
          <button className="btn-ghost w-full" onClick={() => void signOut()}>
            Abmelden
          </button>
        )}
      </div>
    </>
  )
}
