# Paid switchover: everything that changes when we buy

Budget rule until the purchase day: **₹0**. Free plans only; no cards, no trials. Every place that changes when we buy is listed here with the exact env vars and steps, so the switch is configuration, not a rewrite. Keep this file current: add a row whenever new code depends on a paid or swappable service. Last updated 2026-10-23.

## What is already swappable (built, tested)

| Piece | Today (free) | After purchase | How it switches |
|---|---|---|---|
| Semantic search, per corpus | Neon pgvector (`central_emb_256`, `state_emb_256`), 779 MB of 1 GB | Qdrant on the Hetzner server | env only, see section 2 |
| Static data (Supreme Court years, acts lists, High Court lists) | files in `public/data`, copied by `scripts/copy-static-data.mjs`, served by Vercel's CDN | R2 bucket | `STATIC_DATA_BASE_URL`, see section 3 |
| Query embeddings | voyage-4, free 200M tokens, 3 requests a minute | same model, card on file | no code change, see section 1 |

## Not built yet (no code depends on them today)

| Piece | Rule when it is built |
|---|---|
| AI calls (chat, drafting, review, "re-run stronger") | Go through LiteLLM; the model per task lives in one config file; a free model for development, Claude by changing that file. Nothing calls an LLM yet. |
| File storage (Vault, uploads) | Go through one small storage interface (`put`, `get`, `list`, `delete`); local files now, R2 later. Nothing stores user files yet. |

## 1. Voyage (card)

- Today: no payment method, so the account is held to **3 requests a minute and 10,000 tokens a minute** (a longer batch gets a persistent 429). Query embeddings are one request per new search, so a busy site falls back to keyword search with a note.
- Steps: add a payment method in the Voyage dashboard (https://dashboard.voyageai.com). The first 200M tokens stay free; voyage-4 is $0.06 per million tokens after (https://docs.voyageai.com/docs/pricing); one search is about 10 tokens.
- Env: `VOYAGE_API_KEY` stays the same. No code change. The model (`voyage-4`), the normal API (never Batch) and the dimension are fixed in `src/lib/acts/embed.ts`.
- Later option: embed judgments and regulators in-house instead of loading the vectors that ship with the dataset; not needed, the shipped vectors are voyage-4 already.

## 2. Hetzner CAX21 search server (W3, on hold) and Qdrant

- What goes there: judgments (`legal_corpus_v1`, 19.6M points; `legal_corpus_v2`, 11.8M points) and regulators (554k points of `acts_india`), restored from the open-india-law snapshots (see the saved restore notes: mirror throttling, resume constraints).
- To move **Acts** (Central and/or State) from Neon to Qdrant, per corpus, set on Vercel:
  - `SEMANTIC_BACKEND_CENTRAL=qdrant` and/or `SEMANTIC_BACKEND_STATE=qdrant`
  - `QDRANT_URL` (for example `https://search.example.com:6333`), `QDRANT_API_KEY`
  - `QDRANT_COLLECTION_CENTRAL`, `QDRANT_COLLECTION_STATE` (one collection per corpus, or the same `acts_india` with a filter)
  - `QDRANT_FILTER_CENTRAL`, `QDRANT_FILTER_STATE`: Qdrant filter as JSON, for example `{"must":[{"key":"category","match":{"value":"state"}}]}`. Central in `acts_india` is category central **plus the 21 Acts moved by `scripts/acts/fix-misfiled-central.mjs`** (their category is still `state` in Qdrant): use `{"should":[{"key":"category","match":{"value":"central"}},{"key":"act_id","match":{"any":[<the 21 ids>]}}]}`; State then needs those ids in `must_not`.
  - `SEMANTIC_DIM_CENTRAL`, `SEMANTIC_DIM_STATE`: query size for that collection. Default 1024 (the shipped vectors); use 256 if you load 256-d vectors.
  - `QDRANT_VECTOR_NAME` (default `dense`).
- Tested 2026-10-23: Central from local Qdrant (1024-d) with State from Neon (256-d) in one search. Not tested: a remote Qdrant behind TLS and an API key.
- Cost note: a Qdrant search embeds the query once per vector size in use (two sizes = two Voyage calls, both cached).
- New corpora (judgments, regulators) need code, not just config: add the corpus to `CORPORA` in `src/lib/acts/vectorStore.ts`, and a way to show section/case text and metadata for its hits.
- Regulators on Neon first (free alternative): about 450k vectors, about 630 MB at 256-d; a third free Neon project fits them (100 free projects, 1 GB each, https://neon.com/docs/introduction/plans). Set `VECTOR_DATABASE_URL_REGULATOR` once the corpus is added. See `docs/SEMANTIC-ACTS.md` section 6.
- Server steps (when bought): install Docker and Qdrant 1.16.3 (the snapshots come from it), restore the collections, open 6333 only to Vercel or put it behind a reverse proxy with an API key, set the env vars above, run `docker stop`-style clean shutdowns, back up the storage volume.

## 3. Cloudflare R2 (High Court case lists, Vault files)

- Static data today: `public/data/**` is copied from `src/data` at build, served from the same Vercel deployment. This is what filled Vercel's Function Storage before (each deployment kept ~500 MB until fixed); it is now ~5 MB of unique files per deploy.
- Switch: upload `public/data/**` to an R2 bucket with a public domain and set `STATIC_DATA_BASE_URL=https://<r2 public domain>` on Vercel (`src/lib/staticData.ts` already reads it first). Then the copy step can be dropped from `prebuild`.
- High Court case lists (counts only today): upload under `data/judgments/hc/` the same way.
- Vault files (not built): storage interface, then env `STORAGE_BACKEND=r2`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (names planned, not in code yet).

## 4. Anthropic / Claude API through LiteLLM (not built)

- Models per task (config, not code): chat = `claude-haiku-5-5`, drafting and review = `claude-sonnet-5-5`, "re-run stronger" = `claude-opus-5-5`. Development: a free model.
- Env (planned): `LITELLM_BASE_URL`, `LITELLM_API_KEY` (or the LiteLLM proxy master key), `ANTHROPIC_API_KEY` (given to LiteLLM, never to the browser). One config file maps task -> model; no model name appears in components or logic.
- Steps: buy API credits, add the key to the LiteLLM config, change the three task models, no code change.

## 5. Vercel

- Env vars to set on the Vercel project to turn semantic search on in production (not set yet; production runs keyword search with a note): `DATABASE_URL`, `VECTOR_DATABASE_URL`, `VOYAGE_API_KEY`. Never print or commit them.
- Rate limit: 30 searches a minute per address is **in memory per server instance**, so on Vercel it is per instance and approximate. Before charging users, move it to a shared store (a small KV or Redis) and keep the same `createRateLimiter` interface.
- Query-embedding cache is also per instance (500 entries).
- Vercel Pro only if we start charging: higher function and storage limits. Until then keep old deployments deleted (Function Storage hit 100% once).

## 6. Neon (stays free for now)

- Free plan (checked 2026-10-23): 100 projects, 1 GB per project, 20 GB account total, 100 CU-hours per project per month, 2 CU max, scale to zero after 5 minutes (first query after a pause is slow).
- In use: main text database 692 MB; vector database 779 MB (both near the 1 GB limit). Anything bigger (regulators) goes to a new free project, not into these.
- Paid Neon only if a project must exceed 1 GB; then only the connection string changes.
