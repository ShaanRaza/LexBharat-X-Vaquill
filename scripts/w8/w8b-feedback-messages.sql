-- LexBharat: free-text feedback messages from the in-app "Feedback" form (restructure Phase 2). Run once in the Supabase SQL editor (the project that holds the W8 tables).
-- Separate from public.feedback on purpose: that table holds thumbs up/down on one chat answer, draft or review (its checks and unique key assume that), and the stats count it. A message is not a vote.
-- Only the server (secret key) touches this table. The browser is stored as a hash, never the id; no IP address is stored. The email is optional and only used to follow up.
create table if not exists public.feedback_messages (
  id uuid primary key default gen_random_uuid(),
  browser_hash text not null,
  message text not null check (char_length(message) between 3 and 2000),
  email text check (email is null or char_length(email) <= 200),
  page text check (page is null or char_length(page) <= 160),       -- the page the person was on, path only (no query string)
  created_at timestamptz not null default now()
);
create index if not exists feedback_messages_by_time on public.feedback_messages (created_at desc);
alter table public.feedback_messages enable row level security;
revoke all on public.feedback_messages from anon, authenticated;
