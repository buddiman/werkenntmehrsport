-- Schema: types and tables.
-- Logic (triggers, scoring, leaderboard view) is in 20260930000001_logic.sql,
-- security (grants + RLS policies) in 20260930000002_security.sql.

create type public.match_status as enum ('upcoming', 'locked', 'finished');
create type public.bet_type as enum ('score', 'yesno');

-- One row per user; created automatically by a trigger on auth.users.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  avatar       text not null default '⚽' check (char_length(avatar) <= 8),
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.competitions (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,          -- e.g. '2026/27'
  is_current boolean not null default false
);
-- At most one current season.
create unique index seasons_one_current on public.seasons (is_current) where is_current;

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  short_name text not null check (char_length(short_name) between 2 and 5)
);

create table public.matches (
  id                  uuid primary key default gen_random_uuid(),
  competition_id      uuid not null references public.competitions (id),
  season_id           uuid not null references public.seasons (id),
  home_team_id        uuid not null references public.teams (id),
  away_team_id        uuid not null references public.teams (id),
  kickoff_at          timestamptz not null,
  -- Defaults to kickoff_at (trigger). Kept as a column so it could differ later.
  prediction_deadline timestamptz not null,
  -- 'locked' is also derived from the deadline; the stored value lets an admin lock early.
  status              public.match_status not null default 'upcoming',
  -- Exactly one bet type per match.
  bet_type            public.bet_type not null default 'score',
  question            text,                 -- Yes/No question, only for bet_type = 'yesno'
  -- Actual result: score for 'score' matches, answer for 'yesno' matches.
  home_score          integer check (home_score >= 0),
  away_score          integer check (away_score >= 0),
  answer              boolean,
  created_at          timestamptz not null default now(),

  constraint matches_teams_differ check (home_team_id <> away_team_id),
  constraint matches_deadline_before_kickoff check (prediction_deadline <= kickoff_at),
  constraint matches_bet_shape check (
    (bet_type = 'yesno'
      and question is not null and home_score is null and away_score is null)
    or
    (bet_type = 'score'
      and question is null and answer is null
      and (home_score is null) = (away_score is null))
  ),
  constraint matches_finished_has_result check (
    status <> 'finished'
    or (bet_type = 'score' and home_score is not null)
    or (bet_type = 'yesno' and answer is not null)
  ),
  -- Makes re-importing the same fixture list harmless.
  constraint matches_unique_fixture
    unique (competition_id, season_id, home_team_id, away_team_id, kickoff_at)
);
create index matches_season_kickoff on public.matches (season_id, kickoff_at);

create table public.predictions (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  player_id  uuid not null references public.profiles (id) on delete cascade,
  -- Score bet: both scores set. Yes/No bet: answer set. (Checked against the match by a trigger.)
  home_score integer check (home_score >= 0),
  away_score integer check (away_score >= 0),
  answer     boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint predictions_one_per_player_and_match unique (match_id, player_id),
  constraint predictions_scores_together check ((home_score is null) = (away_score is null)),
  constraint predictions_exactly_one_kind check ((home_score is not null) <> (answer is not null))
);
create index predictions_player on public.predictions (player_id);

-- Points per prediction. Written ONLY by private.recompute_match_scores(), never by clients.
create table public.prediction_scores (
  prediction_id uuid primary key references public.predictions (id) on delete cascade,
  points        integer not null check (points >= 0),
  is_exact      boolean not null,   -- exact score (score bets only)
  is_correct    boolean not null    -- correct result 1/X/2 (score bets) or correct answer (Yes/No bets)
);

-- Single-row scoring configuration (the `id` check enforces one row).
create table public.scoring_config (
  id              boolean primary key default true check (id),
  exact_score     integer not null default 3 check (exact_score >= 0),
  goal_difference integer not null default 2 check (goal_difference >= 0),
  correct_result  integer not null default 2 check (correct_result >= 0),
  correct_answer  integer not null default 2 check (correct_answer >= 0),
  updated_at      timestamptz not null default now()
);
insert into public.scoring_config default values;
