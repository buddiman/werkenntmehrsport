-- Security: explicit grants + Row Level Security on every table.
-- The browser only ever holds the PUBLISHABLE key. Everything below is what stops a
-- modified client from doing more than it should.
--
-- Rules:
--  * Only signed-in users (role `authenticated`) can read anything. `anon` gets nothing.
--  * Matches, teams, competitions, seasons, scoring config: everyone reads, only admins write.
--  * Predictions: own rows always visible; other players' rows only once the match is no
--    longer open (deadline = kick-off). Insert/update/delete only while the window is open.
--  * prediction_scores has no write policy at all: only the scoring trigger writes it.
--  * Users can edit only their own display_name/avatar, never is_admin.

grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.prediction_window_open(uuid) to authenticated;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

alter table public.profiles          enable row level security;
alter table public.competitions      enable row level security;
alter table public.seasons           enable row level security;
alter table public.teams             enable row level security;
alter table public.matches           enable row level security;
alter table public.predictions       enable row level security;
alter table public.prediction_scores enable row level security;
alter table public.scoring_config    enable row level security;

-- ---------------------------------------------------------------- grants
-- Column-level grants keep sensitive columns (is_admin, match_id, player_id on update) read-only.

grant select on public.profiles, public.competitions, public.seasons, public.teams,
                public.matches, public.scoring_config, public.prediction_scores,
                public.predictions, public.leaderboard
  to authenticated;

grant update (display_name, avatar) on public.profiles to authenticated;

grant insert, update, delete on public.competitions, public.seasons, public.teams, public.matches
  to authenticated;  -- further limited to admins by the policies below
grant update on public.scoring_config to authenticated;

grant insert (match_id, player_id, home_score, away_score, answer) on public.predictions to authenticated;
grant update (home_score, away_score, answer) on public.predictions to authenticated;
grant delete on public.predictions to authenticated;

-- ---------------------------------------------------------------- profiles

create policy profiles_select on public.profiles
  for select to authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- reference data + matches
-- Same pattern for each: read for everyone, write for admins.

create policy competitions_select on public.competitions for select to authenticated using (true);
create policy competitions_admin_insert on public.competitions for insert to authenticated
  with check (private.is_admin());
create policy competitions_admin_update on public.competitions for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy competitions_admin_delete on public.competitions for delete to authenticated
  using (private.is_admin());

create policy seasons_select on public.seasons for select to authenticated using (true);
create policy seasons_admin_insert on public.seasons for insert to authenticated
  with check (private.is_admin());
create policy seasons_admin_update on public.seasons for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy seasons_admin_delete on public.seasons for delete to authenticated
  using (private.is_admin());

create policy teams_select on public.teams for select to authenticated using (true);
create policy teams_admin_insert on public.teams for insert to authenticated
  with check (private.is_admin());
create policy teams_admin_update on public.teams for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy teams_admin_delete on public.teams for delete to authenticated
  using (private.is_admin());

create policy matches_select on public.matches for select to authenticated using (true);
create policy matches_admin_insert on public.matches for insert to authenticated
  with check (private.is_admin());
create policy matches_admin_update on public.matches for update to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy matches_admin_delete on public.matches for delete to authenticated
  using (private.is_admin());

create policy scoring_config_select on public.scoring_config
  for select to authenticated using (true);
create policy scoring_config_admin_update on public.scoring_config
  for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------- predictions

create policy predictions_select on public.predictions
  for select to authenticated
  using (
    player_id = (select auth.uid())
    or not private.prediction_window_open(match_id)
  );

create policy predictions_insert_own_while_open on public.predictions
  for insert to authenticated
  with check (
    player_id = (select auth.uid())
    and private.prediction_window_open(match_id)
  );

create policy predictions_update_own_while_open on public.predictions
  for update to authenticated
  using (player_id = (select auth.uid()) and private.prediction_window_open(match_id))
  with check (player_id = (select auth.uid()) and private.prediction_window_open(match_id));

create policy predictions_delete_own_while_open on public.predictions
  for delete to authenticated
  using (player_id = (select auth.uid()) and private.prediction_window_open(match_id));

-- ---------------------------------------------------------------- prediction_scores
-- Read-only for clients. Visible exactly when the underlying prediction is visible
-- (the subquery is itself subject to the predictions policy above).

create policy prediction_scores_select on public.prediction_scores
  for select to authenticated
  using (exists (select 1 from public.predictions p where p.id = prediction_id));
