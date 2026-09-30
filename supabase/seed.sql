-- Minimal starting data. Run after the migrations (the SQL editor or `supabase db reset`).
-- Making the first admin is a manual step, on purpose: clients can never set is_admin.
--   update public.profiles set is_admin = true where id = '<your auth user id>';

insert into public.competitions (name) values ('Bundesliga') on conflict do nothing;
insert into public.seasons (name, is_current) values ('2026/27', true) on conflict do nothing;
