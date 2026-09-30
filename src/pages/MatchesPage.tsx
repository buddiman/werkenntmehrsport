import { MatchCard } from '../components/MatchCard'
import { PageHeader } from '../components/PageHeader'
import { formatDay } from '../lib/format'
import { effectiveStatus } from '../lib/matchStatus'
import { useData } from '../data/context'
import type { Match } from '../types/domain'

export function MatchesPage() {
  const { matches } = useData()
  const visible = matches
    .filter((m) => effectiveStatus(m) !== 'finished')
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))

  const byDay = new Map<string, Match[]>()
  for (const m of visible) {
    const day = formatDay(m.kickoff)
    byDay.set(day, [...(byDay.get(day) ?? []), m])
  }

  return (
    <>
      <PageHeader title="Tippen" subtitle="Gib deine Tipps vor dem Anpfiff ab." />
      <div className="space-y-6">
        {[...byDay].map(([day, list]) => (
          <section key={day}>
            <h2 className="label mb-2">{day}</h2>
            <div className="space-y-3">
              {list.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}
