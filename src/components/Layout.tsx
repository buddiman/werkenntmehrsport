import { NavLink, Outlet } from 'react-router-dom'
import { useData } from '../data/context'
import { Icon, type IconName } from './Icon'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Start', icon: 'home' },
  { to: '/matches', label: 'Tippen', icon: 'predict' },
  { to: '/my-predictions', label: 'Meine', icon: 'list' },
  { to: '/leaderboard', label: 'Tabelle', icon: 'trophy' },
  { to: '/history', label: 'Verlauf', icon: 'history' },
]

export function Layout() {
  const { me, isDemo } = useData()

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-6 flex items-center justify-between">
        <NavLink to="/" className="font-display text-xl font-extrabold uppercase tracking-wide">
          Wer kennt <span className="text-lime-brand">mehr Sport?</span>
        </NavLink>
        <div className="flex items-center gap-2">
          {me.isAdmin && (
            <NavLink
              to="/admin"
              aria-label="Admin"
              className="grid size-9 place-items-center rounded-full bg-white/10 hover:bg-white/15"
            >
              <Icon name="shield" className="size-4" />
            </NavLink>
          )}
          <NavLink
            to="/profile"
            aria-label="Profil"
            title={me.displayName}
            className="grid size-9 place-items-center rounded-full bg-pitch-700 text-lg"
          >
            {me.avatar}
          </NavLink>
        </div>
      </header>

      {isDemo && (
        <p className="mb-4 rounded-xl bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-300">
          Demo-Modus: Beispieldaten, nichts wird gespeichert.
        </p>
      )}

      <main>
        <Outlet />
      </main>

      <nav
        aria-label="Hauptmenü"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-white/10 bg-pitch-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      >
        <ul className="mx-auto flex max-w-2xl">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                    isActive ? 'text-lime-brand' : 'text-white/50 hover:text-white/80'
                  }`
                }
              >
                <Icon name={tab.icon} />
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
