-- Logic: helper functions, triggers, scoring and the leaderboard view.
-- Functions live in the `private` schema, which is NOT exposed through the API.
-- Security-definer functions always set search_path = '' and schema-qualify everything.

create schema if not exists private;

-- ---------------------------------------------------------------- helpers

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

-- True while players may still create/change predictions for this match.
-- now() is the database clock, so a player's device clock cannot matter.
create function private.prediction_window_open(p_match_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where m.id = p_match_id
      and m.status = 'upcoming'
      and now() < m.prediction_deadline
  )
$$;

-- ---------------------------------------------------------------- new users

create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
                  nullif(split_part(new.email, '@', 1), ''),
                  'Player'), 30)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- matches

create function private.matches_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.prediction_deadline := coalesce(new.prediction_deadline, new.kickoff_at);
  else
    -- Rescheduling: keep "deadline = kick-off" if that was the case before.
    if new.kickoff_at is distinct from old.kickoff_at
       and new.prediction_deadline = old.prediction_deadline
       and old.prediction_deadline = old.kickoff_at then
      new.prediction_deadline := new.kickoff_at;
    end if;
    if new.bet_type is distinct from old.bet_type
       and exists (select 1 from public.predictions p where p.match_id = old.id) then
      raise exception 'Cannot change the bet type of a match that already has predictions';
    end if;
  end if;
  return new;
end;
$$;

create trigger matches_before_write
  before insert or update on public.matches
  for each row execute function private.matches_before_write();

-- ---------------------------------------------------------------- scoring
-- Mirrors src/lib/scoring.ts. Tiers are exclusive, highest wins:
--   exact score > correct goal difference > correct result (1/X/2); Yes/No: correct answer.

create function private.recompute_match_scores(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m   public.matches;
  cfg public.scoring_config;
begin
  delete from public.prediction_scores ps
  using public.predictions p
  where ps.prediction_id = p.id and p.match_id = p_match_id;

  select * into m from public.matches where id = p_match_id;
  if not found or m.status <> 'finished' then
    return;
  end if;
  select * into cfg from public.scoring_config;

  with r as (
    select
      p.id,
      coalesce(m.bet_type = 'score'
               and p.home_score = m.home_score and p.away_score = m.away_score, false) as is_exact,
      coalesce(m.bet_type = 'score'
               and p.home_score - p.away_score = m.home_score - m.away_score, false) as is_diff,
      coalesce(case m.bet_type
                 when 'score' then sign(p.home_score - p.away_score) = sign(m.home_score - m.away_score)
                 else p.answer = m.answer
               end, false) as is_correct
    from public.predictions p
    where p.match_id = p_match_id
  )
  insert into public.prediction_scores (prediction_id, points, is_exact, is_correct)
  select
    r.id,
    case
      when r.is_exact   then cfg.exact_score
      when r.is_diff    then cfg.goal_difference
      when r.is_correct then case m.bet_type when 'score' then cfg.correct_result
                                             else cfg.correct_answer end
      else 0
    end,
    r.is_exact,
    r.is_correct
  from r;
end;
$$;

-- Finalizing = an admin sets status 'finished' plus the result. This trigger then
-- (re)computes points, so correcting a result later re-scores automatically.
create function private.matches_after_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.recompute_match_scores(new.id);
  return null;
end;
$$;

create trigger matches_recompute_scores
  after insert or update of status, bet_type, home_score, away_score, answer on public.matches
  for each row execute function private.matches_after_write();

-- Changing the scoring rules re-scores every finished match.
create function private.scoring_config_after_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.matches where status = 'finished' loop
    perform private.recompute_match_scores(v_id);
  end loop;
  return null;
end;
$$;

create function private.scoring_config_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger scoring_config_touch
  before update on public.scoring_config
  for each row execute function private.scoring_config_touch();

create trigger scoring_config_rescore
  after update on public.scoring_config
  for each row execute function private.scoring_config_after_update();

-- ---------------------------------------------------------------- predictions

create function private.predictions_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_type public.bet_type;
begin
  select m.bet_type into v_type from public.matches m where m.id = new.match_id;
  if v_type = 'score' and new.home_score is null then
    raise exception 'This match needs a score prediction';
  end if;
  if v_type = 'yesno' and new.answer is null then
    raise exception 'This match needs a Yes/No answer';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger predictions_before_write
  before insert or update on public.predictions
  for each row execute function private.predictions_before_write();

-- ---------------------------------------------------------------- leaderboard
-- security_invoker: the caller's RLS applies. Predictions of finished matches are
-- visible to everyone, so every player sees the same table.
-- Rank: points, then exact predictions; players equal on both share a rank.

create view public.leaderboard
with (security_invoker = true)
as
select
  t.season_id,
  t.player_id,
  t.display_name,
  t.avatar,
  t.total_points,
  t.exact_predictions,
  t.correct_results,
  t.predictions,
  (rank() over (
     partition by t.season_id
     order by t.total_points desc, t.exact_predictions desc
   ))::integer as rank
from (
  select
    s.id as season_id,
    p.id as player_id,
    p.display_name,
    p.avatar,
    coalesce(sum(x.points), 0)::integer   as total_points,
    (count(*) filter (where x.is_exact))::integer   as exact_predictions,
    (count(*) filter (where x.is_correct))::integer as correct_results,
    count(x.points)::integer              as predictions
  from public.seasons s
  cross join public.profiles p
  left join lateral (
    select ps.points, ps.is_exact, ps.is_correct
    from public.predictions pr
    join public.matches m on m.id = pr.match_id and m.season_id = s.id
    join public.prediction_scores ps on ps.prediction_id = pr.id
    where pr.player_id = p.id
  ) x on true
  group by s.id, p.id, p.display_name, p.avatar
) t;
