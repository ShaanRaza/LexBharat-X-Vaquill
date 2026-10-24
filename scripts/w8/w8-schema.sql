-- W8 schema for the Supabase free project. Run ONCE in Supabase > SQL Editor (paste everything, press Run). Safe to run again.
-- Part 1 (scanned PDFs in the Vault): a "waiting" status, new file kinds (jpg, png), a "scanned" flag and one row per page read from a scan.
-- Part 3 (feedback and usage stats): thumbs up/down with an optional comment, and per-day counters with no personal data (the browser is stored only as a hash; never IPs or document text).
-- Only the server touches these tables (secret key). RLS is ON for every table with no policies, so the public (anon) key sees nothing.

-- ---------- Part 1: scans in the Vault
alter table public.vault_documents drop constraint if exists vault_documents_kind_check;
alter table public.vault_documents add constraint vault_documents_kind_check check (kind in ('pdf','docx','txt','jpg','png'));
alter table public.vault_documents drop constraint if exists vault_documents_status_check;
alter table public.vault_documents add constraint vault_documents_status_check check (status in ('processing','ready','unreadable','waiting'));
alter table public.vault_documents add column if not exists scanned boolean not null default false;      -- at least one page was read from an image
alter table public.vault_documents add column if not exists scan_pages int not null default 0;           -- how many pages were read from images
alter table public.vault_documents add column if not exists scan_total int not null default 0;           -- how many image-only pages are being read (at most the per-document limit)
alter table public.vault_documents add column if not exists scan_skipped int not null default 0;         -- image-only pages beyond the limit that were not read

-- one row per page read from an image, so a document that had to wait can resume where it stopped
create table if not exists public.vault_scan_pages (
  doc_id uuid not null references public.vault_documents(id) on delete cascade,
  page int not null,
  browser_id text not null,
  body text not null,
  primary key (doc_id, page)
);
alter table public.vault_scan_pages enable row level security;
revoke all on public.vault_scan_pages from anon, authenticated;

-- ---------- Part 3: feedback
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  browser_hash text not null,                                   -- hash of the browser id, never the id itself
  feature text not null check (feature in ('chat','draft','review')),
  item_id text not null,                                        -- the chat message, draft or review run that was rated
  vote text not null check (vote in ('up','down')),
  reasons text[] not null default '{}',                         -- quick picks: Wrong law, Missing law, Wrong facts, Too vague, Other
  comment text,
  model text,                                                   -- which model produced the item
  snapshot jsonb,                                               -- chat: question, answer and citation labels; draft/review: only names and counts (never document text)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (browser_hash, feature, item_id)
);
create index if not exists feedback_by_time on public.feedback (created_at desc);
create index if not exists feedback_by_vote on public.feedback (vote, created_at desc);
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

-- ---------- Part 3: usage counters (per day, no personal data)
create table if not exists public.usage_daily (
  day date not null,
  metric text not null,          -- visit, chat_asked, draft, review, upload, scan, limit_hit, model_busy, answer_time
  key text not null default '',  -- the page for visit, the template for draft, the limit for limit_hit, the task for model_busy ...
  n bigint not null default 0,   -- how many times
  sum_ms bigint not null default 0,  -- answer_time only: total milliseconds, so the average is sum_ms / n
  primary key (day, metric, key)
);
create table if not exists public.usage_visitors (
  day date not null,
  browser_hash text not null,
  primary key (day, browser_hash)
);
alter table public.usage_daily enable row level security;
alter table public.usage_visitors enable row level security;
revoke all on public.usage_daily, public.usage_visitors from anon, authenticated;

-- add one to a counter (and, for answer_time, the milliseconds); the day is the Indian date
create or replace function public.bump_usage(p_metric text, p_key text default '', p_ms bigint default 0)
returns void language sql security invoker as $$
  insert into public.usage_daily (day, metric, key, n, sum_ms)
  values ((now() at time zone 'Asia/Kolkata')::date, p_metric, coalesce(p_key, ''), 1, coalesce(p_ms, 0))
  on conflict (day, metric, key) do update set n = public.usage_daily.n + 1, sum_ms = public.usage_daily.sum_ms + coalesce(p_ms, 0)
$$;
revoke execute on function public.bump_usage(text, text, bigint) from public, anon, authenticated;
grant execute on function public.bump_usage(text, text, bigint) to service_role;

-- one visit per page per browser per day: returns true only the first time (so reloads are not counted again)
create or replace function public.note_visit(p_hash text, p_page text)
returns boolean language plpgsql security invoker as $$
declare d date := (now() at time zone 'Asia/Kolkata')::date; n int;
begin
  insert into public.usage_visitors (day, browser_hash) values (d, p_hash || '|' || p_page) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then perform public.bump_usage('visit', p_page, 0); end if;
  return n > 0;
end $$;
revoke execute on function public.note_visit(text, text) from public, anon, authenticated;
grant execute on function public.note_visit(text, text) to service_role;
