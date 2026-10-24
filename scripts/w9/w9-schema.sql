-- W9 schema for the Supabase free project. Run ONCE in Supabase > SQL Editor (paste everything, press Run). Safe to run again.
-- Shared limits: every counter (chat, drafting, review, scans, searches) now lives in Supabase, so limits and the monthly AI cap hold across all server instances (Vercel runs several).
--  * Daily / weekly / monthly counts of chat questions, drafts, reviews and scans use the existing append-only table public.vault_usage (kinds 'chat', 'draft', 'review', 'scan').
--  * Per-minute rate limits (searches, drafting retries and template picks) use the new table public.rate_hits through the function public.hit_rate.
-- RLS is ON for the new table with no policies, so the public (anon) key sees nothing; only the server (secret key) uses it.

create index if not exists vault_usage_kind_at on public.vault_usage (kind, at desc);   -- the monthly all-browsers count

create table if not exists public.rate_hits (
  key text not null,                 -- e.g. 'search:203.0.113.7' (the caller's address as the server sees it); old rows are removed by hit_rate
  window_start bigint not null,      -- start of the fixed window, in seconds since 1970
  n int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_hits enable row level security;
revoke all on public.rate_hits from anon, authenticated;

-- Counts one hit for p_key in the current fixed window of p_window_sec seconds. ok = false once the window already holds p_limit hits (that hit is not counted).
create or replace function public.hit_rate(p_key text, p_limit int, p_window_sec int)
returns table (ok boolean, retry_after_sec int)
language plpgsql security invoker as $$
declare
  now_s bigint := floor(extract(epoch from now()))::bigint;
  w bigint := (now_s / p_window_sec) * p_window_sec;
  c int;
begin
  insert into public.rate_hits (key, window_start, n) values (p_key, w, 0) on conflict do nothing;
  update public.rate_hits set n = n + 1 where key = p_key and window_start = w and n < p_limit returning n into c;
  if c is null then return query select false, greatest(1, (w + p_window_sec - now_s))::int; return; end if;
  if random() < 0.02 then delete from public.rate_hits where window_start < now_s - 3600; end if;   -- tidy up now and then
  return query select true, 0;
end $$;
revoke execute on function public.hit_rate(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate(text, int, int) to service_role;
