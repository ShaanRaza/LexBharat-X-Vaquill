# Paid switchover: everything that changes when we buy

Budget rule until the purchase day: **₹0**. Free plans only; no cards, no trials. Every place that changes when we buy is listed here with the exact env vars and steps, so the switch is configuration, not a rewrite. Keep this file current: add a row whenever new code depends on a paid or swappable service. Last updated 2026-10-23 (W5: drafting).

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
| File storage (Vault, uploads) | Built in W6: one `FileStore` interface (`src/lib/vault/storage.ts`); the Supabase bucket now, R2 later by config (section 4d). |

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
- Vault files (W6): they are in a private Supabase Storage bucket behind the `FileStore` interface in `src/lib/vault/storage.ts`. Moving them to R2 means writing an R2 implementation of that interface (about 60 lines with the S3 API: signed upload, get, delete, size, signed download, usage) and setting `VAULT_STORAGE=r2`; the document records stay in Supabase. See section 4d.

## 4. Claude API (and LiteLLM later) for chat, drafting and review

Built in W4: one provider-agnostic layer, `src/lib/ai` (`streamAi`, `completeAi`). The model for each task is read from `src/config/ai-models.json` and can be overridden by environment variable, so switching to Claude is configuration only. Providers in the code: `gemini` (`GEMINI_API_KEY`), `anthropic` (`ANTHROPIC_API_KEY`) and `litellm` (any OpenAI-compatible endpoint: `LITELLM_BASE_URL` + `LITELLM_API_KEY`). No component or logic file names a model.

**Today (free):** `drafting` = `gemini:gemini-3.6-flash` (fallback `gemini:gemini-3.5-flash-lite`, W5), `templatePick` = `gemini:gemini-3.5-flash-lite` (W5), `queryRewrite` = `gemini:gemini-3.5-flash-lite` (W4b), `chat` = `gemini:gemini-3.6-flash` (fallback `gemini:gemini-3.5-flash-lite`), `answerCheck` = `gemini:gemini-3.5-flash-lite` (fallback `gemini:gemini-3.6-flash`); `drafting`, `review`, `rerun` are placeholders on the same Gemini models until those features exist. Chosen on 2026-10-23 from Google's pricing page (free tier) and a latency test with a real retrieval prompt: 3.5-flash-lite 1.3 s to first token, 3.6-flash 2.4 s, 3.1-flash-lite 12 s, 3.8-flash 110 s (unusable on the free tier), 2.5 models closed to new users (HTTP 404). Pages: https://ai.google.dev/gemini-api/docs/pricing, https://ai.google.dev/gemini-api/docs/models, https://ai.google.dev/gemini-api/docs/rate-limits (the per-model free numbers are only shown after sign-in in AI Studio; see `docs/CHAT.md` for what was measured). **Free-tier prompts may be used by Google to improve its products**, so the chat page warns users not to enter confidential client information.

**Switch to Claude (config only), on Vercel:**
1. Set `ANTHROPIC_API_KEY` (credits bought).
2. Set `AI_MODEL_DRAFTING=anthropic:claude-sonnet-5-5` and `AI_MODEL_TEMPLATE_PICK=anthropic:claude-haiku-5-5` (drafting writes one section per call, so a draft is 5 to 10 Sonnet calls; set `DRAFT_LIMIT_*` from the budget), then `AI_MODEL_CHAT=anthropic:claude-haiku-5-5`, `AI_MODEL_ANSWER_CHECK=anthropic:claude-haiku-5-5`, `AI_MODEL_QUERY_REWRITE=anthropic:claude-haiku-5-5`, `AI_MODEL_DRAFTING=anthropic:claude-sonnet-5-5`, `AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5`, `AI_MODEL_RERUN=anthropic:claude-opus-5-5` (or edit `src/config/ai-models.json` and redeploy).
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

- **Gemini free-tier daily limit (found 2026-10-24):** the free tier allows only **20 requests per day per project per model** for `gemini-3.6-flash` (`GenerateRequestsPerDayPerProjectPerModel`; the error says "Please retry in about 22 hours"). Every question, draft part and review part counts, so a day of testing exhausts it and the fallback `gemini-3.5-flash-lite` answers instead (lower quality: shorter clause lists, citations numbered off by one, which `alignCitations` now repairs). A new API key in the **same** Google project does not reset it; only a key from a different project, or a paid plan, does. This is the strongest reason to buy: with Claude (section 4) there is no such cap. `scripts/ai/key-check.mjs` makes one tiny call per task and per model and prints only OK or the error kind.

## 4b. Legal Workspace pages (W4b, W5)

Drafting, Review and Vault are all ON (W5, W6). Each page is switched by one flag in `src/config/workspace.json` (`"enabled"`); set it to false and the sidebar shows "Coming soon" and the page answers 404.

## 4c. Drafting (W5): what changes when we buy

- **Templates** are plain JSON files in `content/templates/` (id = file name). To replace one with a real template: edit or replace the file and redeploy; `scripts/drafting/build-templates.mjs` (runs before dev, build and start) checks every file and stops the build with a list of problems if one is wrong. A section can carry `fixed` text with `{{field}}` tokens (no model call) or an `instruction` for the model. No code change.
- **Models:** the `drafting` task (section by section) and `templatePick`. Free Gemini now; set `AI_MODEL_DRAFTING` / `AI_MODEL_TEMPLATE_PICK` for Claude (section 4). A draft is about 8 model calls on the free tier (about a minute); on Claude Sonnet 5.5 expect roughly 25-40k input tokens per draft because every section call carries the facts and the retrieved law.
- **Limits** (`src/config/drafting-limits.json`, env `DRAFT_LIMIT_DAILY`, `DRAFT_LIMIT_WEEKLY`, `DRAFT_LIMIT_MONTHLY_GLOBAL`): 5 a day, 20 a week per browser, 600 a month in total, 20 saved drafts per browser. The monthly cap is the spending brake.
- **Function time on Vercel:** generating a draft streams for about 1 to 2 minutes (`maxDuration = 300` on the route). Vercel Hobby with Fluid compute allows that; if the project is on a plan or setting limited to 10-60 seconds, drafts will be cut off, and the fix is the paid plan or a longer `maxDuration`.
- **Storage:** drafts, a few version snapshots and usage counters go in the main Neon database (`scripts/drafting/drafting-schema.sql`, apply with `node scripts/drafting/apply-schema.mjs`; the tables already exist in the Neon project used locally). A draft is roughly 15 to 30 kB with its versions, and the main database has little headroom on the free plan (692 MB of 1 GB), so watch it; a bigger Neon plan or a second project removes the limit.
- **PDF font:** the PDF embeds Noto Serif and Noto Serif Devanagari (SIL OFL 1.1, files in `src/lib/drafting/fonts/`), so the rupee sign and Hindi print. Nothing to switch; see `docs/DRAFTING.md`.
- **Email when ready (Resend):** off until both `RESEND_API_KEY` and `RESEND_FROM` are set; the "Email me" field is hidden otherwise. Setup, in order:
  1. Create a free account at https://resend.com (free plan on 2026-10-23: 100 emails a day, 3,000 a month, 3 domains; https://resend.com/pricing).
  2. Add your domain in the Resend dashboard (Domains, Add domain). Resend shows DNS records to add at your domain registrar: an SPF record (a TXT record on the `send` subdomain), a DKIM record (a TXT record on `resend._domainkey`) and an MX record for the `send` subdomain (bounce handling). Add them exactly as shown and press Verify; it can take from a few minutes to a day.
  3. Optionally add a DMARC TXT record (`_dmarc`, value `v=DMARC1; p=none;`) so mailbox providers trust the sender.
  4. Create an API key with "Sending access" (API Keys, Create).
  5. On Vercel set `RESEND_API_KEY=<the key>` and `RESEND_FROM=LexBharat <drafts@your-verified-domain>`; redeploy.
  6. Send one real draft with your own address to test; check the spam folder the first time.
  The address typed by the user is held in memory only long enough to send the message and is never stored or logged. Until a domain is verified Resend only lets you send to your own account address, so test with that.
- **Not tested here:** actual sending through Resend (no account was created); the message building, the off-switch, address checks and error handling are unit-tested with a fake `fetch`.

## 4d. Vault, Review and documents in Chat (W6): what changes when we buy

- **Supabase (free project, in use).** Files: private bucket `Vault` (the bucket name is `VAULT_BUCKET`, default "Vault"; the bucket itself refuses files over 10 MB and anything but PDF, Word and text). Records: tables `vault_documents`, `vault_texts`, `vault_chunks` (with `vector(256)` embeddings), `review_runs`, `vault_usage` plus the functions `match_vault_chunks` and `vault_sizes`, created by running `scripts/vault/vault-schema.sql` once in Supabase's SQL Editor (the secret key cannot run SQL). Every table has Row Level Security on and no policies, and the public roles have no rights; only the server (secret key) reads or writes.
- **Env (server only, never `NEXT_PUBLIC_`):** `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (the new `sb_secret_` key). Set both on Vercel before pushing W6; the Vault and Review answer "not set up" without them. Optional: `VAULT_BUCKET`, `VAULT_SIGNED_URL_SECONDS` (default 60), `VAULT_MAX_DOCS`, `VAULT_MAX_TOTAL_MB`, `VAULT_MAX_FILE_MB`, `VAULT_EMBED_MIN_GAP_MS`, `VAULT_EMBED_BATCH`; for Review `REVIEW_LIMIT_DAILY`, `REVIEW_LIMIT_WEEKLY`, `REVIEW_LIMIT_MONTHLY_GLOBAL`, `REVIEW_PART_CHARS`, `AI_MODEL_REVIEW`, `AI_FALLBACK_REVIEW`.
- **Supabase free limits (checked 2026-10-24):** 500 MB database, 1 GB file storage, projects pause after a week without use. Each text-heavy contract uses about 100 KB of database (text, passages, vectors). Nothing here touches Neon.
- **Move the files to R2:** write an R2 class implementing `FileStore` in `src/lib/vault/storage.ts` (signed upload URL, get, remove, size, signed download, usage; the S3 API supports all of them), add it to `getFileStore()`, set `VAULT_STORAGE=r2` plus the R2 keys. Existing files would need a one-off copy (list the keys in `vault_documents.storage_key`). Records and vectors stay in Supabase.
- **Embedding speed (Voyage):** the free account allows 3 requests a minute and a small token allowance, so a document is prepared in batches of 16 passages, one batch every 21 seconds (`embedMinGapMs`), with a visible "Processing… n/total" status that resumes by itself. A short contract takes under a minute; a long one a few minutes. `maxChunks` (1,200, about 600 pages) stops a huge file from taking hours. With a card on file: set `VAULT_EMBED_MIN_GAP_MS=1000`, raise `VAULT_EMBED_BATCH` to 64, raise `maxChunks` in `src/config/vault-limits.json`.
- **Review model:** the `review` task in `src/config/ai-models.json` (free Gemini now; Claude Sonnet 5.5 later: set `AI_MODEL_REVIEW=anthropic:claude-sonnet-5-5` and `AI_FALLBACK_REVIEW=`). A review is 1 call per 8,000 characters of contract plus 2 (summary, law points); on the free tier the 5-calls-a-minute limit sometimes answers "busy", which the page retries twice by itself before showing "Not reviewed, retry". Per browser 5 reviews a day and 20 a week, 300 a month in total (`src/config/review-limits.json`); the monthly cap is the spending brake.
- **Function time on Vercel:** every Vault and Review call is one short step (under 60 seconds); nothing streams for minutes, so Hobby limits are fine. Uploads go straight from the browser to Supabase with a short-lived signed URL, so Vercel's 4.5 MB request limit does not apply to 10 MB files.
- **Wording to remove after the switch:** the "Testing phase: don't upload confidential client documents" notes (Vault, Review, Chat) once documents are on paid, agreed terms; and "may be used to improve Google's products" if no free Gemini model is left.
- **Not tested here:** the `anthropic` provider for `review` (no key); the R2 store (not written); pausing of the free Supabase project after a week of no use.

## 4e. W8 (Orders/Schedules, scans, statute links, feedback): what changes when we buy

- **Scanned pages (`ocr` task).** Reading image-only pages uses the new `ocr` task in `src/config/ai-models.json` (Gemini document reading today: `gemini:gemini-3.5-flash-lite`, fallback `gemini:gemini-3.6-flash`). To read scans with Claude instead, set `AI_MODEL_OCR=anthropic:claude-haiku-5-5` (or edit the config): the AI layer already sends PDFs and pictures to Claude as document/image blocks. No code change. Free-tier Gemini has a small daily request quota and 3.6-flash runs out first; a 20-page scan is 4 requests (5 pages each), so the free quota is shared with Chat, Drafting and Review.
- **Limits (free-plan guards, in `src/config/vault-limits.json`):** `maxScanPagesPerDoc` 20, `maxScanDocsPerDay` 5 per browser, `scanGroupPages` 5, `scanRetryMs` 30000. Env overrides `VAULT_MAX_SCAN_PAGES`, `VAULT_MAX_SCAN_DOCS_PER_DAY`. When paid: raise the numbers (or set a large number to remove the guard).
- **Voyage embeddings of the 955 Order/Rule/Article units** went in at the free 3 requests a minute (about 100 batches, ~45 minutes). On a paid Voyage account the same load takes minutes: lower `GAP_MS` (21000) in `scripts/supplement/load-supplement.mjs` to about 1000.
- **Supabase (free 500 MB):** new tables `vault_scan_pages`, `feedback`, `usage_daily`, `usage_visitors` (a few KB each; text only). Run `scripts/w8/w8-schema.sql` once in the SQL Editor. The Vault bucket now also accepts JPG/PNG (`node scripts/vault/setup-bucket.mjs`, already run).
- **Main Neon database:** 693 MB before W8 Part 0, 694 MB after (stop line 900 MB). The vector database holds the extra passages in `supplement_emb_256`.
- **Vercel Web Analytics (free, Hobby: 50,000 events a month):** the `@vercel/analytics` package is installed and `<Analytics />` is in `src/app/layout.tsx`. It collects nothing until you switch it on: Vercel dashboard > the project > **Analytics** tab > **Enable**. Nothing else to set.
- **`ADMIN_PASSWORD`** (for `/admin/insights`) must be set in `.env.local` locally and as a Vercel environment variable on the live site, and must differ from `ACCESS_PASSWORD` (the page refuses to open if they are equal). Not set on Vercel by us.

## 4f. W9: shared limits (Supabase) and what stays per instance

- **All limits and the monthly AI cap are counted in Supabase now** (run `scripts/w9/w9-schema.sql` once in the SQL Editor): chat questions, drafts, reviews and scans are rows in `vault_usage` (kinds `chat`, `draft`, `review`, `scan`; per browser per India day and rolling week, and **all browsers together per calendar month** for the monthly cap); per-minute limits (searches 30, drafting retries 12, template picks 15) use `rate_hits` through `hit_rate`. Config numbers are unchanged in `src/config/{chat,drafting,review,vault}-limits.json`.
- When Supabase is not configured (a bare local setup) chat and drafting fall back to the old Neon counters and the per-minute limits to a per-process limiter, so nothing breaks; production must have Supabase set.
- **Going paid:** raise or remove the numbers in the config files; the monthly cap (`monthlyGlobal`) is the guard against surprise AI bills, so set it from the AI budget (questions x average cost) before switching.
- Still per instance (not limits, only caches): the query-embedding cache (500 entries) and the model-busy retry timing.
- The old Neon tables `chat_usage` and `draft_usage` are no longer written when Supabase is set; they can be dropped later.

## 5. Vercel

- Env vars to set on the Vercel project (none are set for W2b/W2c/W4 yet; production runs keyword search with a note and, once W4 is pushed, **closed behind the password page until `ACCESS_PASSWORD` and `ACCESS_COOKIE_SECRET` are set**): `DATABASE_URL`, `VECTOR_DATABASE_URL`, `VOYAGE_API_KEY`, `GEMINI_API_KEY`, `ACCESS_PASSWORD`, `ACCESS_COOKIE_SECRET`. Optional: `CHAT_LIMIT_DAILY`, `CHAT_LIMIT_WEEKLY`, `CHAT_LIMIT_MONTHLY_GLOBAL`, `AI_MODEL_*`. Never print or commit them.
- Run `node scripts/chat/apply-schema.mjs` once against the production database before the first chat (the tables already exist in the Neon project used locally).
- Rate limit: 30 searches a minute per address is counted in Supabase (`rate_hits`, `hit_rate`), so it holds across Vercel instances (W9). If Supabase is unreachable it falls back to a per-process limiter. Behind Vercel's proxy the address comes from `x-forwarded-for`; keep that header trusted only at the edge.
- Query-embedding cache is also per instance (500 entries).
- Vercel Pro only if we start charging: higher function and storage limits. Until then keep old deployments deleted (Function Storage hit 100% once).

## 6. Neon (stays free for now)

- Free plan (checked 2026-10-23): 100 projects, 1 GB per project, 20 GB account total, 100 CU-hours per project per month, 2 CU max, scale to zero after 5 minutes (first query after a pause is slow).
- In use: main text database 692 MB (chats add a few MB at most); vector database 779 MB (both near the 1 GB limit). Anything bigger (regulators) goes to a new free project, not into these.
- Paid Neon only if a project must exceed 1 GB; then only the connection string changes.


## OpenRouter / OpenAI (providers added 2026-10-29)

- **What was added:** two OpenAI-style providers in `src/lib/ai/providers.mjs`: `openrouter` (one key, many makers; model names are prefixed, e.g. `openrouter:anthropic/claude-sonnet-5.5`, `openrouter:google/gemini-3.5-flash-lite`) and `openai` (api.openai.com direct). Base URL, key variable name and extra headers come from the `providers` block of `src/config/ai-models.json` (OpenRouter sends `HTTP-Referer: https://app.lexbharat.ai` and `X-Title: LexBharat`). Key: `OPENROUTER_API_KEY` (in `.env.local` and Vercel Production + Preview). Gemini stays each task's `fallback`; embeddings stay on Voyage. PDFs/images go as file/image parts; OpenRouter's reported `cost` is passed through in `usage`.
- **Self-test:** `/api/vault/selftest?openrouter=1` adds the row **"OpenRouter, direct"**: one tiny request, no retries, and it states how much of the key's credit is left.
- **The key:** a monthly limit of **$2** (not free tier, resets monthly). Checked 2026-10-29: $1.32 left before the evaluation, $0.90 after (the eval and two flawed first runs used about $0.42). `node scripts/ai/openrouter-info.mjs [regex]` prints the credit and matching models/prices (never the key).
- **Scorecard (`scripts/ai/scorecard.mjs`):** the real chat prompt on 12 real statute sections (gold section + 3 other Acts' sections, shuffled) and 4 "not in the sources" questions; score 0-3 per answer (cites the right source [n], names section and Act, a fixed judge model says the legal answer is right) and 1 per "not found". Results (2026-10-29, one run each, small sample, so differences of a point or two are noise):

| Model | Score | Cites right source | Names section+Act | Judge: right | Not-found | First text | Total | Cost / question (list price) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gemini:gemini-3.5-flash-lite (today, free tier) | 36/40 | 11/12 | 10/12 | 11/12 | 4/4 | 1.6 s | 2.1 s | $0.0013 (you pay 0) |
| openrouter:google/gemini-3.5-flash-lite | **37/40** | 11/12 | 11/12 | 11/12 | 4/4 | 1.2 s | 1.8 s | $0.0013 |
| openrouter:openai/gpt-4.1-mini | 32/40 | 12/12 | 6/12 | 10/12 | 4/4 | 1.0 s | 1.8 s | $0.0012 |
| openrouter:anthropic/claude-haiku-5.5 | 28/40 | 8/12 | 8/12 | 8/12 | 4/4 | 4.2 s | 4.8 s | $0.0008 |
| openrouter:anthropic/claude-sonnet-5.5 (6 + 1 questions) | 18/19 | 6/6 | 6/6 | 6/6 | 0/1 | 4.3 s | 5.0 s | $0.0129 |

  Caveats: sources are handed to the model (retrieval is not tested); the judge is one cheap model; Gemini's speed varies by the hour on the free tier (it was 8 s in an earlier run today). Sonnet missed the one "not found" it was given.
- **Applied 2026-10-29 (decision):** `chat`, `answerCheck`, `queryRewrite`, `templatePick` -> `openrouter:google/gemini-3.5-flash-lite` (about $0.002 per question: $0.0013 answer + about $0.0004 check), fallback `gemini:gemini-3.5-flash-lite` then `gemini:gemini-3.6-flash` (free). `review`, `drafting`, `rerun`, `ocr` stay on free Gemini.
- **Spend guard (`spendGuard` in `ai-models.json`, `src/lib/ai/guard.mjs`):** before a task uses an OpenRouter model, the key's remaining credit is read (`GET /key`, cached 5 minutes per server instance). Below **$0.25** the OpenRouter model is skipped and every task goes straight to its free Gemini fallback; at or above it, or if the credit cannot be read, the paid model is used. Shown as the "Spend guard (OpenRouter credit)" row of the self-test and as a note at the top of /admin. The key's own $2 monthly limit is the hard stop; the guard stops us before it. Change the threshold in `ai-models.json`. Evals use free Gemini only (decision 2026-10-29).
- **Plan once credit is bought:** `review` and `drafting` -> `openrouter:anthropic/claude-sonnet-5.5` ($2 in / $10 out per million tokens; about $0.06 per contract review and $0.12 per draft, estimated, not measured; in the scorecard Sonnet got 18/19 on 7 questions vs 36/40 for flash-lite on 16). Set `AI_MODEL_REVIEW` / `AI_MODEL_DRAFTING`, keep Gemini as fallback, raise the key limit first (at $2 a month it covers about 15 reviews or 7 drafts), and list OpenRouter and the model maker in the Privacy page for those features too (they currently name Google directly).
- **Privacy wording (done):** the Privacy, Terms and Security pages (`src/data/legal.ts`) say Ask questions go to Google's Gemini through OpenRouter, and to Google directly if that route is unavailable; the "free AI" slow-notice now says "the AI is slow right now". OpenRouter's own privacy settings are set by the owner in its dashboard.
