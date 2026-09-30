/** Turns a Supabase/Postgres error into a short German message for the UI. */
export function friendlyError(error: { message: string; code?: string }): string {
  const m = error.message
  if (error.code === '42501' || /row-level security|permission denied/i.test(m)) {
    return 'Das ist nicht erlaubt. Ist die Tippabgabe schon geschlossen?'
  }
  if (error.code === '23505') return 'Das gibt es schon.'
  if (/bet type of a match that already has predictions/i.test(m)) {
    return 'Die Tipp-Art kann nicht geändert werden, solange es schon Tipps gibt.'
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) {
    return 'Keine Verbindung zum Server.'
  }
  return m
}
