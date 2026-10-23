# Paid switchover: everything that changes when we buy

Budget rule until the purchase day: **₹0**. Free plans only; no cards, no trials. Every place that changes when we buy is listed here with the exact env vars and steps, so the switch is configuration, not a rewrite. Keep this file current: add a row whenever new code depends on a paid or swappable service. Last updated 2026-10-23 (W4: access password, chat).

## What is already swappable (built, tested)

| Piece | Today (free) | After purchase | How it switches |
|---|---|---|---|
| Semantic search, per corpus | Neon pgvector (`central_emb_256`, `state_emb_256`), 779 MB of 1 GB | Qdrant on the Hetzner server | env only, see section 2 |
| Static data (Supreme Court years, acts lists, High Court lists) | files in `public/data`, copied by `scripts/copy-static-data.mjs`, served by Vercel's CDN | R2 bucket | `STATIC_DATA_BASE_URL`, see section 3 |
| Query embeddings | voyage-4, free 200M tokens, 3 requests a minute | same model, card on file | no code change, see section 1 |
| Chat and answer-check models (per task) | Gemini free tier (`gemini-3.6-flash` chat, `gemini-3.5-flash-lite` check) | Claude Haiku 5.5 / Sonnet 5.5 / Opus 5.5 | `src/config/ai-models.json` or `AI_MODEL_<TASK>` env, see section 4 |

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

## 4. Claude API (and LiteLLM later) for chat, drafting and review

Built in W4: one provider-agnostic layer, `src/lib/ai` (`streamAi`, `completeAi`). The model for each task is read from `src/config/ai-models.json` and can be overridden by environment variable, so switching to Claude is configuration only. Providers in the code: `gemini` (`GEMINI_API_KEY`), `anthropic` (`ANTHROPIC_API_KEY`) and `litellm` (any OpenAI-compatible endpoint: `LITELLM_BASE_URL` + `LITELLM_API_KEY`). No component or logic file names a model.

**Today (free):** `queryRewrite` = `gemini:gemini-3.5-flash-lite` (W4b), `chat` = `gemini:gemini-3.6-flash` (fallback `gemini:gemini-3.5-flash-lite`), `answerCheck` = `gemini:gemini-3.5-flash-lite` (fallback `gemini:gemini-3.6-flash`); `drafting`, `review`, `rerun` are placeholders on the same Gemini models until those features exist. Chosen on 2026-10-23 from Google's pricing page (free tier) and a latency test with a real retrieval prompt: 3.5-flash-lite 1.3 s to first token, 3.6-flash 2.4 s, 3.1-flash-lite 12 s, 3.8-flash 110 s (unusable on the free tier), 2.5 models closed to new users (HTTP 404). Pages: https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/models, https://ai.google.dev/gemini-api/docs/rate-limits (the per-model free numbers are only shown after sign-in in AI Studio; see `docs/CHAT.md` for what was measured). **Free-tier prompts may be used by Google to improve its products**, so the chat page warns users not to enter confidential client information.

**Switch to Claude (config only), on Vercel:**
1. Set `ANTHROPIC_API_KEY` (credits bought).
2. Set `AI_MODEL_CHAT=anthropic:claude-haiku-5-5`, `AI_MODEL_ANSWER_CHECK=anthropic:claude-haiku-5-5`, `AI_MODEL_QUERY_REWRITE=anthropic:claude-haiku-5-5`, `AI_MODEL_DRAFTING=anthropic:claude-sonnet-5-5`, `AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5`, `AI_MODEL_RERUN=anthropic:claude-opus-5-5` (or edit `src/config/ai-models.json` and redeploy).
3. Set `AI_FALLBACK_CHAT=` and `AI_FALLBACK_ANSWER_CHECK=` (empty; `queryRewrite` has no fallback) to drop the Gemini fallbacks, or point them at another Claude model.
4. Remove the "testing phase" and "may be used to improve Google's products" wording (`ChatApp.tsx`) once no free Gemini model is used. Raise `CHAT_LIMIT_*` (below).
5. Cost note for the limits: each question is two calls (answer + check). The monthly global cap (`CHAT_LIMIT_MONTHLY_GLOBAL`, default 3,000 questions) is the spending brake; set it from the budget.

**Move to LiteLLM later (on the Hetzner server):** a LiteLLM proxy is its own server process, so it is not used yet. When the CAX21 is up: run LiteLLM there (Docker), put the Claude and Gemini keys in its config, then set `LITELLM_BASE_URL=https://<server>/v1`, `LITELLM_API_KEY=<proxy key>` on Vercel and change the specs to `litellm:<name in the proxy config>`, for example `AI_MODEL_CHAT=litellm:claude-haiku-5-5`. The `litellm` provider already speaks the OpenAI-compatible streaming API, so no code changes.

**Not tested here:** the `anthropic` and `litellm` providers are tested with fake streams (request shape, streaming parse, usage, errors, fallback), not against the live services, because no keys exist yet. Run one real question through each after the switch.

## 4a. Access password (built in W4, free)

- Env vars (all three needed on Vercel before the first push of W4): `ACCESS_PASSWORD` (the shared password), `ACCESS_COOKIE_SECRET` (random, at least 32 characters; generated into `.env.local`; make a different one for production with `node -e 'console.log(require("crypto").randomBytes(48).toString("base64url"))'`), plus the existing `DATABASE_URL`, `VECTOR_DATABASE_URL`, `VOYAGE_API_KEY`, `GEMINI_API_KEY`.
- Missing `ACCESS_PASSWORD` or `ACCESS_COOKIE_SECRET` in production: the whole site answers "Site not configured" (503) and never opens (fail closed). Changing `ACCESS_PASSWORD` or the secret logs everyone out.
- Wrong passwords have no lockout: each wrong try is answered after about 1 second and nothing else limits attempts (a long, random password is therefore the protection). The search rate limit (30 a minute per address) and the chat limits are **in memory per server instance**: on Vercel that means per instance, so they are approximate. Before charging users, move the counters to a shared store (Upstash Redis or Vercel KV have free tiers) behind the same interfaces (`createRateLimiter`).
- Real accounts later: this gate is a shared password, not user accounts (no Google sign-in in the MVP). The anonymous browser id cookie (`lb_bid`) keys chats and limits and is the hook for Vault and drafts; replacing it with real user ids later means changing where `x-lb-bid` comes from (`src/middleware.ts`).

## 4b. Legal Workspace pages that are switched off (W4b)

Drafting, Review and Vault show in the sidebar and dashboard as greyed "Coming soon". Each is switched on by one flag in `src/config/workspace.json` (`"enabled": true`); the page at its `href` (`/workspace/drafting`, `/workspace/review`, `/workspace/vault`) must exist first. Vault will need the storage interface and R2 (section 3); drafting and review use the `drafting` and `review` tasks in `src/config/ai-models.json` (planned: Claude Sonnet 5.5, with `rerun` on Opus 5.5). Nothing about the free plan changes.

## 5. Vercel

- Env vars to set on the Vercel project (none are set for W2b/W2c/W4 yet; production runs keyword search with a note and, once W4 is pushed, **closed behind the password page until `ACCESS_PASSWORD` and `ACCESS_COOKIE_SECRET` are set**): `DATABASE_URL`, `VECTOR_DATABASE_URL`, `VOYAGE_API_KEY`, `GEMINI_API_KEY`, `ACCESS_PASSWORD`, `ACCESS_COOKIE_SECRET`. Optional: `CHAT_LIMIT_DAILY`, `CHAT_LIMIT_WEEKLY`, `CHAT_LIMIT_MONTHLY_GLOBAL`, `AI_MODEL_*`. Never print or commit them.
- Run `node scripts/chat/apply-schema.mjs` once against the production database before the first chat (the tables already exist in the Neon project used locally).
- Rate limit: 30 searches a minute per address is **in memory per server instance**, so on Vercel it is per instance and approximate. Before charging users, move it to a shared store (a small KV or Redis) and keep the same `createRateLimiter` interface.
- Query-embedding cache is also per instance (500 entries).
- Vercel Pro only if we start charging: higher function and storage limits. Until then keep old deployments deleted (Function Storage hit 100% once).

## 6. Neon (stays free for now)

- Free plan (checked 2026-10-23): 100 projects, 1 GB per project, 20 GB account total, 100 CU-hours per project per month, 2 CU max, scale to zero after 5 minutes (first query after a pause is slow).
- In use: main text database 692 MB (chats add a few MB at most); vector database 779 MB (both near the 1 GB limit). Anything bigger (regulators) goes to a new free project, not into these.
- Paid Neon only if a project must exceed 1 GB; then only the connection string changes.
