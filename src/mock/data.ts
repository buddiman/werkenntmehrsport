/**
 * MOCK DATA ONLY. Replaced by Supabase queries in a later step.
 * Kick-off times are relative to "now" so the demo always shows a mix of
 * finished, locked and open matches.
 */
import type { Match, Player, Prediction, Team } from '../types/domain'

const HOUR = 3_600_000
const at = (hoursFromNow: number) => new Date(Date.now() + hoursFromNow * HOUR).toISOString()

const team = (id: string, name: string, shortName: string): Team => ({ id, name, shortName })
const T = {
  fcb: team('fcb', 'Bayern München', 'FCB'),
  bvb: team('bvb', 'Borussia Dortmund', 'BVB'),
  rbl: team('rbl', 'RB Leipzig', 'RBL'),
  scf: team('scf', 'SC Freiburg', 'SCF'),
  b04: team('b04', 'Bayer Leverkusen', 'B04'),
  sge: team('sge', 'Eintracht Frankfurt', 'SGE'),
  vfb: team('vfb', 'VfB Stuttgart', 'VFB'),
  svw: team('svw', 'Werder Bremen', 'SVW'),
  bmg: team('bmg', 'Borussia M\'gladbach', 'BMG'),
  koe: team('koe', '1. FC Köln', 'KOE'),
  hsv: team('hsv', 'Hamburger SV', 'HSV'),
  m05: team('m05', 'Mainz 05', 'M05'),
}

const QUESTION = 'Mehr als 2,5 Tore?'

/** Score bet by default; pass `question` for a Yes/No bet. `result` is [home, away] or, for Yes/No, a boolean. */
function match(
  id: string,
  home: Team,
  away: Team,
  kickoffInHours: number,
  result?: [number, number] | boolean,
  question?: string,
): Match {
  const kickoff = at(kickoffInHours)
  const isYesNo = question !== undefined
  return {
    id,
    competitionId: 'c1',
    competition: 'Bundesliga',
    seasonId: 's1',
    season: '2026/27',
    kickoff,
    predictionDeadline: kickoff, // the deadline is kick-off
    homeTeam: home,
    awayTeam: away,
    status: result === undefined ? 'upcoming' : 'finished',
    betType: isYesNo ? 'yesno' : 'score',
    question: question ?? null,
    homeScore: Array.isArray(result) ? result[0] : null,
    awayScore: Array.isArray(result) ? result[1] : null,
    answer: typeof result === 'boolean' ? result : null,
  }
}

export const matches: Match[] = [
  // Finished
  match('m1', T.fcb, T.b04, -24 * 13, [2, 2]),
  match('m2', T.bvb, T.rbl, -24 * 13, [3, 0]),
  match('m3', T.scf, T.sge, -24 * 12, false, QUESTION),
  match('m4', T.vfb, T.svw, -24 * 6, [0, 0]),
  match('m5', T.bmg, T.koe, -24 * 6, [1, 3]),
  match('m6', T.hsv, T.m05, -24 * 5, true, QUESTION),
  // Locked: kicked off, result pending
  match('m7', T.b04, T.bvb, -1.2),
  // Open
  match('m8', T.fcb, T.bvb, 26),
  match('m9', T.rbl, T.scf, 29, undefined, QUESTION),
  match('m10', T.sge, T.vfb, 50),
  match('m11', T.svw, T.bmg, 74),
  match('m12', T.koe, T.hsv, 75, undefined, QUESTION),
  match('m13', T.m05, T.fcb, 98),
]

export const players: Player[] = [
  { id: 'p1', displayName: 'Chris', avatar: '🦊', isAdmin: true },
  { id: 'p2', displayName: 'Lena', avatar: '🐯', isAdmin: false },
  { id: 'p3', displayName: 'Tobi', avatar: '🦁', isAdmin: false },
  { id: 'p4', displayName: 'Mara', avatar: '🐼', isAdmin: false },
  { id: 'p5', displayName: 'Jonas', avatar: '🐸', isAdmin: false },
  { id: 'p6', displayName: 'Sophie', avatar: '🦄', isAdmin: false },
  { id: 'p7', displayName: 'Ben', avatar: '🐙', isAdmin: false },
]

export const CURRENT_PLAYER_ID = 'p1'

// Small deterministic PRNG so the mock leaderboard is stable between reloads.
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function buildPredictions(): Prediction[] {
  const rand = seeded(42)
  const goals = () => Math.floor(rand() * 3.4)
  const out: Prediction[] = []
  for (const m of matches) {
    const isOpen = m.status === 'upcoming' && new Date(m.predictionDeadline).getTime() > Date.now()
    for (const p of players) {
      // On open matches only the current player has (some) picks; others' picks stay hidden.
      if (isOpen && (p.id !== CURRENT_PLAYER_ID || ['m10', 'm11', 'm12', 'm13'].includes(m.id))) {
        continue
      }
      const home = goals()
      const away = goals()
      const yesNo = m.betType === 'yesno'
      out.push({
        id: `${m.id}-${p.id}`,
        matchId: m.id,
        playerId: p.id,
        homeScore: yesNo ? null : home,
        awayScore: yesNo ? null : away,
        answer: yesNo ? rand() > 0.5 : null,
        createdAt: at(-24 * 14),
      })
    }
  }
  return out
}

export const initialPredictions: Prediction[] = buildPredictions()
