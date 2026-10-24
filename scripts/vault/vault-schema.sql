-- Vault + Review schema for the Supabase free project (run once in Supabase > SQL Editor).
-- Only the server touches these tables (secret key). RLS is ON for every table with no policies, so the public (anon) key sees nothing.
-- Idempotent: safe to run again.
create extension if not exists vector with schema extensions;

create table if not exists public.vault_documents (
  id uuid primary key default gen_random_uuid(),
  browser_id text not null,
  name text not null,
  kind text not null check (kind in ('pdf','docx','txt')),
  size_bytes bigint not null,
  pages int,
  status text not null default 'processing' check (status in ('processing','ready','unreadable')),
  status_detail text,
  storage_key text not null,
  chunk_count int not null default 0,
  embedded_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vault_documents_browser on public.vault_documents (browser_id, created_at desc);

create table if not exists public.vault_texts (
  doc_id uuid primary key references public.vault_documents(id) on delete cascade,
  browser_id text not null,
  body text not null,
  page_starts jsonb
);

create table if not exists public.vault_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.vault_documents(id) on delete cascade,
  browser_id text not null,
  idx int not null,
  page int,
  label text,
  body text not null,
  embedding extensions.vector(256)
);
create index if not exists vault_chunks_doc on public.vault_chunks (doc_id, idx);
create index if not exists vault_chunks_browser on public.vault_chunks (browser_id);

create table if not exists public.review_runs (
  id uuid primary key default gen_random_uuid(),
  browser_id text not null,
  doc_id uuid references public.vault_documents(id) on delete set null,
  doc_name text not null,
  contract_type text not null,
  side text not null,
  status text not null default 'running' check (status in ('running','done','partial','failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists review_runs_browser on public.review_runs (browser_id, created_at desc);

-- append-only usage log, so deleting a review does not reset the daily/weekly limit
create table if not exists public.vault_usage (
  id bigint generated always as identity primary key,
  browser_id text not null,
  kind text not null,
  at timestamptz not null default now()
);
create index if not exists vault_usage_lookup on public.vault_usage (browser_id, kind, at desc);

alter table public.vault_documents enable row level security;
alter table public.vault_texts enable row level security;
alter table public.vault_chunks enable row level security;
alter table public.review_runs enable row level security;
alter table public.vault_usage enable row level security;
revoke all on public.vault_documents, public.vault_texts, public.vault_chunks, public.review_runs, public.vault_usage from anon, authenticated;

-- nearest chunks for one browser, optionally limited to some documents
create or replace function public.match_vault_chunks(query_embedding extensions.vector(256), p_browser text, p_doc_ids uuid[], p_k int)
returns table (id uuid, doc_id uuid, idx int, page int, label text, body text, similarity float)
language sql stable security invoker set search_path = public, extensions as $$
  select c.id, c.doc_id, c.idx, c.page, c.label, c.body, 1 - (c.embedding <=> query_embedding) as similarity
  from public.vault_chunks c
  where c.browser_id = p_browser and c.embedding is not null and (p_doc_ids is null or c.doc_id = any(p_doc_ids))
  order by c.embedding <=> query_embedding
  limit p_k
$$;
revoke execute on function public.match_vault_chunks(extensions.vector, text, uuid[], int) from public, anon, authenticated;
grant execute on function public.match_vault_chunks(extensions.vector, text, uuid[], int) to service_role;

-- sizes for the docs (database bytes used by the vault tables)
create or replace function public.vault_sizes()
returns table (db_bytes bigint, documents bigint, chunks bigint)
language sql stable security invoker as $$
  select pg_database_size(current_database()),
         (select count(*) from public.vault_documents), (select count(*) from public.vault_chunks)
$$;
revoke execute on function public.vault_sizes() from public, anon, authenticated;
grant execute on function public.vault_sizes() to service_role;
