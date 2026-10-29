-- Gap log: every answer that named a section the library does not hold, and every "not found" answer, so testers' real gaps drive the next downloads (shown on /admin).
-- Paste this into the Supabase SQL editor once. It stores the question text (up to 300 characters), the Act and the section; it does NOT store the browser id, an IP address or any document text,
-- and nothing is logged for a question that had a Vault document attached.
create table if not exists public.gap_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('missing_section', 'unreliable_section', 'not_found')),
  question text not null,
  act text,
  section text,
  act_id text
);
create index if not exists gap_log_at_idx on public.gap_log (at desc);
alter table public.gap_log enable row level security;   -- only the server's secret key reads or writes it
