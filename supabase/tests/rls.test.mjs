// Runs the real migrations against an in-process Postgres (PGlite) and checks the
// security and scoring rules. No Docker or Supabase project needed:  npm run test:db
//
// Supabase-specific pieces (auth schema, auth.uid(), the anon/authenticated roles) are
// stubbed below. Everything else is the real SQL from supabase/migrations.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const db = new PGlite()

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)
for (const file of readdirSync(join(root, 'migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'))
}
await db.exec(readFileSync(join(root, 'seed.sql'), 'utf8'))

// ------------------------------------------------------------------ helpers
async function as(role, uid, fn) {
  await db.exec(`set role ${role}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ''])
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}
const q = async (sql, params) => (await db.query(sql, params)).rows
const affected = async (sql, params) => (await db.query(sql, params)).affectedRows

async function rejects(fn, pattern, label) {
  try {
    await fn()
  } catch (e) {
    assert.match(String(e.message), pattern, `${label}: wrong error: ${e.message}`)
    return
  }
  assert.fail(`${label}: expected an error but it succeeded`)
}

let passed = 0
async function test(name, fn) {
  await fn()
  passed += 1
  console.log(`  ok  ${name}`)
}

// ------------------------------------------------------------------ fixtures (as superuser)
const user = async (name) =>
  (await q(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name}@example.com`, JSON.stringify({ display_name: name })],
  ))[0].id
const [admin, bob, cara, dan] = [await user('Admin'), await user('Bob'), await user('Cara'), await user('Dan')]
await q(`update public.profiles set is_admin = true where id = $1`, [admin])

const [{ id: competition }] = await q(`select id from public.competitions limit 1`)
const [{ id: season }] = await q(`select id from public.seasons where is_current`)
const team = async (n, s) => (await q(`insert into public.teams (name, short_name) values ($1, $2) returning id`, [n, s]))[0].id
const [t1, t2, t3, t4] = [await team('Team One', 'ONE'), await team('Team Two', 'TWO'), await team('Team Three', 'THR'), await team('Team Four', 'FOU')]
const match = async (home, away, extra = '') =>
  (await q(
    `insert into public.matches (competition_id, season_id, home_team_id, away_team_id, kickoff_at, bet_type, question)
     values ($1, $2, $3, $4, now() + interval '1 day', ${extra ? `'yesno', 'Over 2.5 goals?'` : `'score', null`}) returning id`,
    [competition, season, home, away],
  ))[0].id
const mScore = await match(t1, t2)
const mYesNo = await match(t3, t4, 'yesno')
const pickScore = (uid, h, a, m = mScore) =>
  q(`insert into public.predictions (match_id, player_id, home_score, away_score) values ($1, $2, $3, $4)`, [m, uid, h, a])
const pickYesNo = (uid, ans) =>
  q(`insert into public.predictions (match_id, player_id, answer) values ($1, $2, $3)`, [mYesNo, uid, ans])

// ------------------------------------------------------------------ tests
console.log('Schema & profiles')
await test('signing up creates a profile with the display name', async () => {
  const rows = await q(`select display_name, is_admin from public.profiles where id = $1`, [bob])
  assert.deepEqual(rows, [{ display_name: 'Bob', is_admin: false }])
})
await test('deadline defaults to kick-off', async () => {
  const [m] = await q(`select kickoff_at = prediction_deadline as same from public.matches where id = $1`, [mScore])
  assert.equal(m.same, true)
})
await test('anonymous users can read nothing', async () => {
  await rejects(() => as('anon', null, () => q(`select * from public.matches`)), /permission denied/, 'anon')
})
await test('a user cannot make themselves admin', async () => {
  await rejects(
    () => as('authenticated', bob, () => q(`update public.profiles set is_admin = true where id = $1`, [bob])),
    /permission denied/, 'self-promotion',
  )
})
await test("a user cannot edit someone else's profile", async () => {
  const n = await as('authenticated', bob, () =>
    affected(`update public.profiles set display_name = 'Hacked' where id = $1`, [cara]))
  assert.equal(n, 0)
})

console.log('Matches (admin only)')
await test('normal users cannot create, change or delete matches', async () => {
  await rejects(() => as('authenticated', bob, () =>
    q(`insert into public.matches (competition_id, season_id, home_team_id, away_team_id, kickoff_at)
       values ($1,$2,$3,$4, now() + interval '2 days')`, [competition, season, t1, t3])),
    /row-level security/, 'insert')
  assert.equal(await as('authenticated', bob, () => affected(`update public.matches set status = 'finished'`)), 0)
  assert.equal(await as('authenticated', bob, () => affected(`delete from public.matches`)), 0)
})
await test('admins can create matches', async () => {
  await as('authenticated', admin, () =>
    q(`insert into public.matches (competition_id, season_id, home_team_id, away_team_id, kickoff_at)
       values ($1,$2,$3,$4, now() + interval '2 days')`, [competition, season, t1, t3]))
})
await test('normal users cannot change scoring rules', async () => {
  assert.equal(await as('authenticated', bob, () => affected(`update public.scoring_config set exact_score = 99`)), 0)
})

console.log('Predictions')
await test('a player can predict an open match, scores and yes/no', async () => {
  await as('authenticated', bob, () => pickScore(bob, 2, 0))
  await as('authenticated', bob, () => pickYesNo(bob, true))
  await as('authenticated', cara, () => pickScore(cara, 3, 1))
  await as('authenticated', cara, () => pickYesNo(cara, false))
  await as('authenticated', dan, () => pickScore(dan, 1, 0))
  await as('authenticated', admin, () => pickScore(admin, 0, 1))
})
await test('only one prediction per player per match', async () => {
  await rejects(() => as('authenticated', bob, () => pickScore(bob, 1, 1)), /duplicate key/, 'duplicate')
})
await test("a player cannot predict on another player's behalf", async () => {
  const m = await match(t2, t3)
  await rejects(() => as('authenticated', bob, () => pickScore(cara, 1, 1, m)), /row-level security/, 'impersonation')
})
await test('the prediction type must match the match bet type', async () => {
  const m = await match(t2, t4)
  await rejects(() => as('authenticated', dan, () => pickScore(dan, 1, 1, mYesNo)),
    /needs a Yes\/No answer/, 'score on yes/no match')
  await rejects(() => as('authenticated', cara, () =>
    q(`insert into public.predictions (match_id, player_id, answer) values ($1,$2,true)`, [m, cara])),
    /needs a score prediction/, 'yes/no on score match')
})
await test("others' predictions are hidden before kick-off, own are visible", async () => {
  const rows = await as('authenticated', bob, () => q(`select player_id from public.predictions where match_id = $1`, [mScore]))
  assert.deepEqual(rows.map((r) => r.player_id), [bob])
})
await test('a player can change their prediction while the match is open', async () => {
  const n = await as('authenticated', bob, () =>
    affected(`update public.predictions set home_score = 2, away_score = 0 where match_id = $1 and player_id = $2`, [mScore, bob]))
  assert.equal(n, 1)
})
await test('match_id / player_id / points cannot be changed by clients', async () => {
  await rejects(() => as('authenticated', bob, () =>
    q(`update public.predictions set player_id = $1 where player_id = $2`, [cara, bob])), /permission denied/, 'player_id')
  await rejects(() => as('authenticated', bob, () =>
    q(`insert into public.prediction_scores values ((select id from public.predictions limit 1), 99, true, true)`)),
    /permission denied/, 'scores insert')
})

// --- kick-off passes (time travel as superuser)
await q(`update public.matches set kickoff_at = now() - interval '1 hour',
                                   prediction_deadline = now() - interval '1 hour'
         where id in ($1, $2)`, [mScore, mYesNo])

console.log('After the deadline')
await test('predictions can no longer be created', async () => {
  const [{ id: late }] = await q(`select id from public.profiles where display_name = 'Dan'`)
  await rejects(() => as('authenticated', dan, () => pickYesNo(late, true)), /row-level security/, 'late insert')
})
await test('predictions can no longer be changed or deleted', async () => {
  const upd = await as('authenticated', bob, () =>
    affected(`update public.predictions set home_score = 9, away_score = 9 where match_id = $1 and player_id = $2`, [mScore, bob]))
  assert.equal(upd, 0)
  assert.equal(await as('authenticated', bob, () => affected(`delete from public.predictions where player_id = $1`, [bob])), 0)
  const [p] = await q(`select home_score, away_score from public.predictions where match_id = $1 and player_id = $2`, [mScore, bob])
  assert.deepEqual(p, { home_score: 2, away_score: 0 })
})
await test("everyone's predictions become visible", async () => {
  const rows = await as('authenticated', bob, () => q(`select player_id from public.predictions where match_id = $1`, [mScore]))
  assert.equal(rows.length, 4)
})

console.log('Finalizing and scoring')
await test('a normal user cannot enter results', async () => {
  const n = await as('authenticated', bob, () =>
    affected(`update public.matches set status='finished', home_score=9, away_score=9 where id = $1`, [mScore]))
  assert.equal(n, 0)
})
await test('a finished match needs a result', async () => {
  await rejects(() => as('authenticated', admin, () =>
    q(`update public.matches set status = 'finished' where id = $1`, [mScore])), /matches_finished_has_result/, 'no result')
})
await test('finalizing awards points: exact 3, difference 2, result 2, wrong 0, yes/no 2', async () => {
  await as('authenticated', admin, async () => {
    await q(`update public.matches set status='finished', home_score=2, away_score=0 where id = $1`, [mScore])
    await q(`update public.matches set status='finished', answer=true where id = $1`, [mYesNo])
  })
  const rows = await as('authenticated', cara, () => q(`
    select pl.display_name as name, m.bet_type as type, ps.points, ps.is_exact, ps.is_correct
    from public.prediction_scores ps
    join public.predictions p on p.id = ps.prediction_id
    join public.profiles pl on pl.id = p.player_id
    join public.matches m on m.id = p.match_id
    order by name, type`))
  const pts = Object.fromEntries(rows.map((r) => [`${r.name}/${r.type}`, r.points]))
  assert.deepEqual(pts, {
    'Admin/score': 0, // 0:1 vs 2:0 -> wrong
    'Bob/score': 3, 'Bob/yesno': 2, // exact; correct answer
    'Cara/score': 2, 'Cara/yesno': 0, // 3:1 has the same goal difference; wrong answer
    'Dan/score': 2, // 1:0 has the right result only
  })
  assert.equal(rows.find((r) => r.name === 'Bob' && r.type === 'score').is_exact, true)
})
await test('leaderboard totals and ranking', async () => {
  const rows = await as('authenticated', bob, () =>
    q(`select display_name, total_points, exact_predictions, correct_results, predictions, rank
       from public.leaderboard order by rank, display_name`))
  assert.deepEqual(rows, [
    { display_name: 'Bob', total_points: 5, exact_predictions: 1, correct_results: 2, predictions: 2, rank: 1 },
    { display_name: 'Cara', total_points: 2, exact_predictions: 0, correct_results: 1, predictions: 2, rank: 2 },
    { display_name: 'Dan', total_points: 2, exact_predictions: 0, correct_results: 1, predictions: 1, rank: 2 },
    { display_name: 'Admin', total_points: 0, exact_predictions: 0, correct_results: 0, predictions: 1, rank: 4 },
  ])
})
await test('correcting a result re-scores automatically', async () => {
  await as('authenticated', admin, () => q(`update public.matches set home_score=0, away_score=1 where id = $1`, [mScore]))
  const [{ points }] = await q(`select ps.points from public.prediction_scores ps join public.predictions p on p.id = ps.prediction_id
                                where p.player_id = $1 and p.match_id = $2`, [admin, mScore])
  assert.equal(points, 3)
  await as('authenticated', admin, () => q(`update public.matches set home_score=2, away_score=0 where id = $1`, [mScore]))
})
await test('changing the scoring rules re-scores finished matches', async () => {
  await as('authenticated', admin, () => q(`update public.scoring_config set exact_score = 5`))
  const [{ points }] = await q(`select ps.points from public.prediction_scores ps join public.predictions p on p.id = ps.prediction_id
                                where p.player_id = $1 and p.match_id = $2`, [bob, mScore])
  assert.equal(points, 5)
})

console.log(`\n${passed} tests passed`)
