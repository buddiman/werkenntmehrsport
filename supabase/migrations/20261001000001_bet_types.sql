-- Bet types and scoring, version 2.
--
-- Every match has exactly one bet type:
--   score    predict the final score.       exact 3 > correct goal difference 2 > correct tendency 1
--   outcome  1X2 pick (buttons 1, X, 2).    correct pick 2
--   winner   1 or 2 only (no draw).         correct pick 2 (result is 1 or 2, e.g. who advances)
--   yesno    Yes/No question with free text. correct answer 2

-- ---------------------------------------------------------------- columns

alter table public.matches     add column outcome text check (outcome in ('1', 'X', '2'));
alter table public.predictions add column outcome text check (outcome in ('1', 'X', '2'));

alter table public.scoring_config rename column correct_result to correct_tendency;
alter table public.scoring_config alter column correct_tendency set default 1;
alter table public.scoring_config
  add column correct_outcome integer not null default 2 check (correct_outcome >= 0),
  add column correct_winner  integer not null default 2 check (correct_winner >= 0);

-- ---------------------------------------------------------------- constraints

alter table public.matches
  drop constraint matches_bet_shape,
  drop constraint matches_finished_has_result;

alter table public.matches add constraint matches_bet_shape check (
  (bet_type = 'score'
    and question is null and answer is null and outcome is null
    and (home_score is null) = (away_score is null))
  or
  (bet_type = 'yesno'
    and question is not null and home_score is null and away_score is null and outcome is null)
  or
  (bet_type = 'outcome'
    and question is null and answer is null and home_score is null and away_score is null)
  or
  (bet_type = 'winner'
    and question is null and answer is null and home_score is null and away_score is null
    and (outcome is null or outcome <> 'X'))
);

alter table public.matches add constraint matches_finished_has_result check (
  status <> 'finished'
  or (bet_type = 'score' and home_score is not null)
  or (bet_type = 'yesno' and answer is not null)
  or (bet_type in ('outcome', 'winner') and outcome is not null)
);

alter table public.predictions drop constraint predictions_exactly_one_kind;
alter table public.predictions add constraint predictions_exactly_one_kind check (
  (home_score is not null)::int + (answer is not null)::int + (outcome is not null)::int = 1
);

-- ---------------------------------------------------------------- grants
-- Clients may set/change the pick columns; nothing else (see the security migration).

grant insert (outcome) on public.predictions to authenticated;
grant update (outcome) on public.predictions to authenticated;

-- ---------------------------------------------------------------- prediction type check

create or replace function private.predictions_before_write()
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
  if v_type = 'outcome' and new.outcome is null then
    raise exception 'This match needs a 1/X/2 pick';
  end if;
  if v_type = 'winner' and (new.outcome is null or new.outcome = 'X') then
    raise exception 'This match needs a winner pick (1 or 2)';
  end if;
  -- (predictions_exactly_one_kind guarantees the other pick columns are empty.)
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- scoring
-- Mirrors src/lib/scoring.ts.

create or replace function private.recompute_match_scores(p_match_id uuid)
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
      -- "correct" = right tendency (score), right answer (yesno) or right pick (outcome/winner)
      coalesce(case m.bet_type
                 when 'score' then sign(p.home_score - p.away_score) = sign(m.home_score - m.away_score)
                 when 'yesno' then p.answer = m.answer
                 else p.outcome = m.outcome
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
      when r.is_correct then case m.bet_type
                               when 'score'   then cfg.correct_tendency
                               when 'yesno'   then cfg.correct_answer
                               when 'outcome' then cfg.correct_outcome
                               else cfg.correct_winner
                             end
      else 0
    end,
    r.is_exact,
    r.is_correct
  from r;
end;
$$;

-- Re-score when the new result column changes, too.
drop trigger matches_recompute_scores on public.matches;
create trigger matches_recompute_scores
  after insert or update of status, bet_type, home_score, away_score, answer, outcome on public.matches
  for each row execute function private.matches_after_write();

-- Tendency is now worth 1 point; this also re-scores any finished matches.
update public.scoring_config set correct_tendency = 1;
