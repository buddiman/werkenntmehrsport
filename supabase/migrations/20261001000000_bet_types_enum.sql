-- New bet types. Kept in its own migration: Postgres cannot use a newly added enum value
-- in the same transaction that adds it (the next migration uses them).
--   'outcome' = 1X2 pick (home win / draw / away win)
--   'winner'  = 1 or 2 only (no draw), e.g. for knockout ties
alter type public.bet_type add value if not exists 'outcome';
alter type public.bet_type add value if not exists 'winner';
