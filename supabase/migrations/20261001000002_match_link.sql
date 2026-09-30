-- Optional link per match (e.g. Kicker or Flashscore) so players can look at stats before tipping.
-- Only http(s) URLs are allowed, so the app can never render a javascript: link.
alter table public.matches
  add column info_url text
  constraint matches_info_url_is_http check (
    info_url is null or (char_length(info_url) <= 500 and info_url ~* '^https?://[^[:space:]]+$')
  );
