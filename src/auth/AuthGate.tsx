import type { Session } from '@supabase/supabase-js'
import { useEffect, useState, type ReactNode } from 'react'
import { DemoProvider } from '../data/DemoProvider'
import { SupabaseProvider } from '../data/SupabaseProvider'
import { supabase } from '../lib/supabase'
import { LoginPage } from '../pages/LoginPage'

/**
 * Chooses the data source:
 *  - no Supabase env vars  -> demo mode (mock data, no login)
 *  - Supabase configured   -> login required, real data
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabase) return <DemoProvider>{children}</DemoProvider>
  return <SupabaseGate client={supabase}>{children}</SupabaseGate>
}

function SupabaseGate({
  client,
  children,
}: {
  client: NonNullable<typeof supabase>
  children: ReactNode
}) {
  // undefined = still checking for a stored session
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    void client.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = client.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [client])

  if (session === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <p className="animate-pulse text-white/60">Lade …</p>
      </div>
    )
  }
  if (!session) return <LoginPage client={client} />

  return (
    <SupabaseProvider supabase={client} session={session}>
      {children}
    </SupabaseProvider>
  )
}
