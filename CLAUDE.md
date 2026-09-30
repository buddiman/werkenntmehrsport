# Wer kennt mehr Sport? — private sports prediction league

Mobile-first web app where a group of friends predict match results for points and bragging rights.
**No real money, no gambling.**

## Status

- Phase 1 (done): UI, German texts.
- Phase 2 (done): schema, RLS and scoring in `supabase/`, verified by `npm run test:db`.
- Phase 3 (done, **untested against a live project**): Supabase client, login, real data, admin writes, Pages workflow.
- Next: create the Supabase project, apply migrations, smoke-test end to end, fix what breaks, first deploy.

## Hard architecture rules

- **Static frontend only**, hosted on GitHub Pages. No server, no runtime Node.
- **Supabase is the only external runtime service** (Postgres + Auth). No other third-party requests at runtime
  (fonts are self-hosted through `@fontsource`; do not add CDN links or Google Fonts).
- **Never** put a service-role key or any secret in frontend code. Only the public **publishable** key (`sb_publishable_...`; the legacy `anon` key is being deprecated by Supabase)
  is allowed, via `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`. Everything `VITE_*` is public by design.
- **Security lives in the database** (Row Level Security + SQL functions), never only in the UI.
  Client-side checks (e.g. `isAdmin` route guard, disabled buttons) are convenience only.
- Relational, normalized schema. No unnecessary frameworks or infrastructure.
- Routing uses **`HashRouter`** and Vite `base: './'` because GitHub Pages cannot rewrite URLs.
  Do not switch to `BrowserRouter` without adding a 404.html fallback strategy.

## Stack

React 19 · TypeScript (strict, `erasableSyntaxOnly`: no enums/namespaces) · Vite · Tailwind CSS v4
(`@tailwindcss/vite`, theme tokens in `src/index.css` `@theme`; custom classes via `@utility`, not `@layer components`)
· react-router-dom · oxlint. Later: `@supabase/supabase-js`.

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck (`tsc -b`) + production build into `dist/`
- `npm run lint` — oxlint
- `npm run preview` — serve the production build
- `npm run test:db` — applies `supabase/migrations` to an in-process Postgres (PGlite) and checks RLS + scoring

## Project layout

```
src/
  types/domain.ts     Domain types; mirror the planned DB tables
  lib/                Pure logic, no React, no I/O
    scoring.ts          Configurable scoring (ScoringConfig + scorePrediction)
    leaderboard.ts      Ranking (later replaced by a Postgres view)
    matchStatus.ts      effectiveStatus(): upcoming | locked | finished
    format.ts           Date/countdown formatting
    import/             Match import; one MatchImportParser per format, registered in index.ts
  data/               DataValue contract + providers (SupabaseProvider, DemoProvider), error messages
  auth/               AuthGate (chooses provider, login gate)
  mock/data.ts        Demo-mode data only
  components/         Reusable UI (Layout, MatchCard, ScoreStepper, ...)
  pages/              One file per route
```

UI code gets data **only through `useData()`** (`src/data/context.ts`, the `DataValue` contract).
Two providers implement it: `SupabaseProvider` (real, needs login) and `DemoProvider` (mock data). `AuthGate` picks
one: **no `VITE_SUPABASE_*` env vars = demo mode** (amber banner), otherwise login is required.
Reads go through RLS-filtered queries; admin writes (`AdminApi`) are plain table updates that only succeed for admins.
Predictions are saved with insert/update (not upsert): clients may only update pick columns.

## Domain rules

- One prediction per player per match (unique `(match_id, player_id)`).
- **Prediction deadline = kick-off.** Predictions can't be created/changed from then on: enforce in RLS/trigger, not just UI.
- Match status: `upcoming | locked | finished`. A finished match needs a result matching its bet type (DB constraint). `effectiveStatus()` treats a passed deadline as locked.
- Others' predictions are hidden until kick-off (decided): enforce in RLS. Own predictions always visible.
- Only admins can write matches/results. Finalizing a match computes points server-side.

## Scoring (configurable, never hard-code numbers outside `DEFAULT_SCORING_CONFIG`)

Every match has **exactly one bet type** (`match.betType`):

| Type | Pick | Points (defaults) |
| --- | --- | --- |
| `score` | final score | exact **3** > correct goal difference **2** > correct tendency (same winner / draw) **1**; highest tier wins |
| `outcome` | 1 / X / 2 buttons | correct pick **2** |
| `winner` | 1 / 2 buttons (no draw) | correct pick **2** |
| `yesno` | Yes/No with a free question text | correct answer **2** |

Examples (score): result 3:1 - bet 3:1 = 3, bet 2:0 = 2, bet 1:0 = 1; result 0:0 - bet 1:1 = 2 (same difference).
All values live in the single-row `scoring_config` table and are editable in the Admin area; changing them
re-scores all finished matches. Scoring exists twice and **must be changed together**: `src/lib/scoring.ts`
(demo mode) and `private.recompute_match_scores()` in the newest migration that defines it.
Leaderboard "correct results" counts right tendencies, picks and answers. Tie-break: points, exact predictions, correct results.

## Database (`supabase/`)

- `migrations/` — `_schema` (tables), `_logic` (triggers, scoring, `leaderboard` view), `_security` (grants + RLS),
  `_bet_types_enum` + `_bet_types` (four bet types, scoring v2), `_match_link` (optional `matches.info_url`, http(s) only). Plain SQL, Supabase-CLI compatible. Migrations are
  applied by hand in the SQL editor, in filename order; **apply a new migration before deploying frontend code that needs it**. `seed.sql` — competition, season. `tests/rls.test.mjs` — security/scoring tests.
- Tables: profiles, competitions, seasons, teams, matches, predictions, prediction_scores, scoring_config (single row).
- Helper functions live in the un-exposed `private` schema; security-definer functions set `search_path = ''`.
- Every table has RLS and explicit grants; `anon` has no access. Views use `security_invoker`.
- Admin = `profiles.is_admin`. Clients can't set it (column grants); the first admin is set by hand in the SQL editor.
- **Finalizing a match** = admin updates the match to `status = 'finished'` with the result; a trigger computes
  `prediction_scores`. Correcting a result or changing `scoring_config` re-scores automatically. No RPC needed.
- `prediction_scores` has no client write access at all.
- The deadline is enforced by RLS (`private.prediction_window_open`) using the database clock, not the device clock.
  SQL-editor/superuser edits bypass RLS by design (for admin repairs).
- **Sign-ups:** anyone with the URL + publishable key could call sign-up. For a private league, disable
  "Allow new users to sign up" in Supabase Auth settings and invite friends from the dashboard.
- When editing policies or scoring, update `tests/rls.test.mjs` and keep `npm run test:db` green. SQL scoring mirrors `src/lib/scoring.ts`;
  change both together.

## Setup and deploy

- Local: copy `.env.example` to `.env.local`, fill URL + publishable key (`npm run dev`). Empty = demo mode.
- Users are created by the admin in the Supabase dashboard (sign-ups disabled). Login is email + password.
  Prefer "Add user" with a password; invite/recovery links put tokens in the URL hash, which collides with `HashRouter`.
- Deploy: push to `main`; `.github/workflows/deploy.yml` runs lint, `test:db`, build, then publishes to GitHub Pages.
  Needs repo variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and Settings > Pages > Source = "GitHub Actions".

## Import

Format `list` (`src/lib/import/listFormat.ts`), one match per line, `#` = comment, trailing empty columns may be omitted:
`YYYY-MM-DD HH:mm | League | Bet type | Home | Away [| Question [| Link]]`.
Bet type: `score`, `1x2`, `winner`, `yesno` (German aliases accepted). Question is required for `yesno` and forbidden otherwise.
Link is optional http(s). Unknown leagues are created on import (flagged "(neu)" in the preview); existing fixtures are
skipped on re-import. The parser exposes `instructions`, a short prompt the admin copies to an LLM to generate lists;
**keep it in sync with the parser**. To add a format, implement `MatchImportParser` and register it in `importParsers`.
No scraping (Kicker/Flashscore) for now.

## Conventions

- Small function components, Tailwind utilities inline, shared look via the `card` / `btn-*` / `label` utilities.
- Mobile first: design for ~375px, bottom tab bar, safe-area insets respected; `max-w-2xl` content column.
- Dates are ISO strings (UTC) in data, formatted only at the edge (`lib/format.ts`).
- UI language: **German** (informal "du"). Code, comments and docs stay English. Keep copy short and friendly.
- Keep `npm run build` and `npm run lint` green before committing.
