const kickoffFmt = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const dayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })

export const formatKickoff = (iso: string) => kickoffFmt.format(new Date(iso))
export const formatDay = (iso: string) => dayFmt.format(new Date(iso))

/** "2 T 4 Std", "3 Std 10 Min", "25 Min" or "Vorbei" once the time has passed. */
export function timeLeft(iso: string, now: number = Date.now()): string {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) return 'Vorbei'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  if (days > 0) return `${days} T ${hours} Std`
  if (hours > 0) return `${hours} Std ${minutes % 60} Min`
  return `${minutes} Min`
}

/** ISO timestamp -> value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
