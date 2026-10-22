# LexBharat Legal Workspace — planning report

Written 2026-10-22. Investigation only: nothing was built, installed, signed up for, or spent. All data figures were measured on the local open-india-law snapshot `v2026.08` (CC BY 4.0) with the DuckDB CLI on the LAWSSD drive; prices were read from the vendors' own pages today (links in the Sources list). Where a number is my estimate rather than a measurement or a quoted price, it is labelled **(estimate)**; where I could not confirm something it is labelled **(unverified)**.

**Acts section text available: Partly** — the text is there for every one of the 22,264 instruments (nothing is missing at the row level), but ~12% of Acts carry no section numbers, section/chapter labels are sometimes wrong, and a measurable slice of the regulator text (mainly Hindi) is garbled. Details in §1.

## Summary

- **Data:** 1,098,269 text chunks (544,078 legislation + 554,191 regulator rows) holding ~1.12 billion characters. Chunks reassemble into sections reliably using the suffix in `chunk_id` (99.95% of split sections are contiguous) — this settles the "chunk ordering" blocker recorded in `docs/ACTS-PHASE1.md`.
- **Search:** recommend **Postgres full-text search** as the target (one database for keyword + vectors + Vault metadata + drafts), starting on a free tier for central Acts and moving to a ~$25/month plan when State Acts and vectors go in. A static sharded index is a legitimate free fallback for keyword-only.
- **Embeddings:** the whole corpus is ~115 M tokens for Central + State Acts and ~240–285 M tokens including regulators **(estimate)**. Cheapest credible path: **voyage-4 or voyage-4-lite, whose first 200 M tokens are free**, which covers Central + State Acts at ₹0; the legal-specific `voyage-law-2` would cost about ₹730 for the same scope. Quality on Indian legal English and Hindi is **not documented by any vendor I checked**, so Phase 2 starts with a small bake-off on your own queries.
- **Stack at ~100 users:** roughly **₹2,400/month** (Supabase Pro) plus ₹1,900 if the site is commercial (Vercel Pro) plus LLM usage for drafting; email, sign-in and Vault storage fit inside free allowances.

---

## 1. Acts full text

**Where it lives.** `/Volumes/LAWSSD/open-india-law/` (drive must be mounted). Legislation: 37 files `in_<state|central>_legislation.parquet` (175 MB compressed). Regulator instruments: 12 files `in_<body>_regulations.parquet` (215 MB compressed). One row = one **chunk** of an Act/instrument, not one section; the full text is in the `text` column. Other useful columns: `act_id, title, chunk_id, chapter, section_number, section_title, jurisdiction, state, act_status, in_force, year, acts_referenced[], defined_terms[], has_proviso, source_url, source_publisher, language_code`.

**Counts (measured).**

| | Legislation | Regulator instruments | Total |
|---|---:|---:|---:|
| Instruments (distinct `act_id`) | 10,112 (1,568 central, 8,544 state/UT) | 12,152 | 22,264 |
| Chunk rows | 544,078 | 554,191 | 1,098,269 |
| Rows with non-empty text | 544,078 (100%) | 554,191 (100%) | 1,098,269 |
| Instruments with any text | 10,112 | 12,152 | 22,264 |
| Distinct numbered sections with text (`act_id` + non-blank `section_number`) | 208,390 | 109,745 | 318,135 |
| Characters of text | 517.3 M | 601.9 M | 1.119 B |
| UTF-8 bytes of text | 527.6 MB | 714.3 MB | 1.24 GB |
| Unique chunk texts (exact duplicates removed) | 489,911 | 495,577 | 985,488 |

By status after de-duplication: Central in force 57,020 chunks (59.3 M chars); Central repealed 14,186 (13.9 M); Central spent 282; **State in force 418,423 (393.1 M chars)** — the file holds no repealed state rows; regulator instruments in force 440,483 (477.8 M) and superseded 55,188 (68.3 M).

**Reassembly rule that works.** `chunk_id` encodes order: `…_s138` (whole section), `…_s138_p0/_p1…` (parts of a long section), `…_s007_4_d2` (sub-clause variants), `…_b022` (non-section blocks). For the 90,706 split sections, **90,637 (99.9%) have contiguous parts starting at `_p0`**; 69 have a gap or duplicate. No duplicate `chunk_id` exists in either set. `_dK` variants (≈29,800 legislation / 68,700 regulator rows) repeat the parent section's text with a different chapter label and need a collapse rule — to be validated in Phase 0 (below).

**Languages.** `language_code` is `en` on **100% of rows**, which is wrong: 8,433 legislation chunks (369 Acts) and **154,621 regulator chunks (3,170 instruments)** contain Devanagari. 919 / 243 further chunks contain other Indic scripts. Treat the field as unreliable; detect script yourself.

**Quality problems (measured, counts are chunks).**

| Problem | Legislation | Regulators |
|---|---:|---:|
| No `section_number` (chunks cannot be tied to a section) | 20,749 (3.8%) | 15,985 (2.9%) |
| Acts with no section numbers at all (from `docs/ACTS-PHASE1.md`) | 1,230 of 10,112 (12%) | not measured |
| Contains U+FFFD replacement character (lost characters) | 7,582 (1.4%) in 744 Acts | 32,147 (5.8%) in 1,299 instruments |
| Hindi text that looks mojibake (words starting with a vowel sign; legacy-font PDF extraction) | 2,079 chunks in 64 Acts | **41,486 chunks in 1,776 instruments** |
| Letter-spaced headings ("O F I N T E R N A T I O N A L") | 312 (151 Acts) | 347 (56) |
| Footnote markers glued into text (`4[a term…`) | 40,750 | 34,688 |
| HTML entities left in text | 682 | 6,703 |
| Words glued together (25+ lowercase letters) | 3,029 | 813 |
| Fragments under 150 characters | 1,054 | 1,879 |
| Wrong chapter label on a chunk | seen in sample below (not counted) | seen |

**Three real samples** (text trimmed; verbatim from the parquet files).

*Central Act — Negotiable Instruments Act, 1881, section 138, assembled from `IND_central_2189_s138_p0` + `_p1` (complete: offence, proviso (a)–(c), Explanation):*
```
Act: The Negotiable Instruments Act, 1881 (Act 26 of 1881) | India | Central | In Force
Chapter XVI: O F I N T E R N A T I O N A L LA W | Section 138: Dishonour of cheque for insufficiency, etc., of funds in the account

**138. Dishonour of cheque for insufficiency, etc., of funds in the account.—** Where any cheque drawn by a person on an account maintained by him with a banker … is returned by the bank unpaid … such person shall be deemed to have committed an offence … punished with imprisonment for 4[a term which may be extended to two years'], or with fine which may extend to twice the amount of the cheque, or with both:
Provided that nothing contained in this section shall apply unless— ( _a_ ) thecheque has been presented to the bank within a period of six months … ( _b_ ) … 5[within thirty days] … ( _c_ ) the drawer … fails to make the payment … within fifteen days of the receipt of the said notice.
_Explanation_ .—For the purposes of this section, "debt of other liability" means a legally enforceable debt or other liability.
```
Text is complete and legally correct, but the chapter label is wrong (the section is in Chapter XVII, "Of penalties in case of dishonour of certain cheques"; another chunk labelled `XVII` is a stray block), the heading is letter-spaced, `4[`/`5[` are footnote markers, and "thecheque" has a missing space.

*State Act — The Maharashtra Rent Control Act, 1999, section 7, `IND_state_15817_s007_p0` (long definitions section split into ≥10 parts, `_p9` seen):*
```
Act: The Maharashtra Rent Control Act, 1999 (Act 18 of 1999) | India | State | In Force
Chapter I: ## PRELIMINARY | Section 7: Definitions

**7. Definitions.—** In this Act, unless there is anything repugnant to the subject or context,—
 - ( _1_ ) "Competent Authority" means the competent authority appointed under section 40;
 - ( _2_ ) "Government allottee",— ( _a_ ) In relation to any premises requisitioned or continued under requisition …
```
Clean, ordered text; markdown artifacts (`**`, `##`, `_1_`) are present and need stripping for display and embedding. Source: `https://www.indiacode.nic.in/handle/123456789/15817?view_type=browse`.

*Regulator instrument — RBI (All India Financial Institutions – Know Your Customer) Directions, 2025, `REG_RBI_335…_s005_p5_d1`:*
```
Act: Reserve Bank of India (All India Financial Institutions – Know Your Customer) Directions, 2025 (Updated as on December 29, 2025) (Act RBI/DOR/2025-26/335 of 2025) | India | Regulatory | In Force
Chapter XI: Repeal and Other Provisions** | Section 5: **Regarding the real-estate agents, dealers of precious metals/stones**

(vii) In case any designated individual/ entity is a shareholder/ director/ … the ROC should convey the complete details … to section 12A Nodal officer of Ministry of Corporate Affairs. …
```
Readable English, but this is a mid-clause continuation chunk labelled with a chapter and heading that do not belong to it (heading bleed from the PDF layout). Source: `https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12969`.

*Garbled example (flagged):* `SEBI (Prohibition of Insider Trading) Regulations, 2015`, section 3, `REG_SEBI_sebiregulations34612…_s003` — the Hindi text reads `िानकारी के प्रसार और अप्रकालशत कीमत संिेदिशीि जािकारी…` (should be `जानकारी के प्रसार और अप्रकाशित मूल्य संवेदनशील जानकारी…`). This is the typical legacy-font mojibake; it is unusable for Hindi search or embeddings.

**Bottom line.** For English Central and State Acts the text is fit for v1 search and display, with a cleaning pass. For regulators and any Hindi text, v1 should either exclude the garbled chunks or show them with a clear "text extraction unreliable — open the source PDF" notice (the `source_url` points at the official document).

---

## 2. Keyword search plan

**What I measured for sizing.** Word-level inverted index over unique chunk texts: Central in-force 57,020 chunks → 9.2 M word occurrences, 55,120 distinct words, **4.31 M postings**; a 10% sample of State in-force (46,655 chunks) → 6.7 M occurrences, 153,080 words, 3.44 M postings, extrapolating to ~**34 M postings** for all State Acts. Regulators are roughly State-sized again.

| | (a) Postgres FTS on hosted free Postgres | (b) Static sharded index (like the HC party-name search) |
|---|---|---|
| Mechanism | `tsvector` column + GIN index, `websearch_to_tsquery`, `ts_rank`, `ts_headline` snippets | Build-time JSON shards of `word → delta-encoded chunk ids` (as in `scripts/judgments/build-hc-search-index.mjs`), served as static files; the browser/API fetches only the shards for the query's words |
| Index size | GIN typically 30–60% of text size **(estimate, not measured)**; Postgres compresses stored text roughly 2× **(estimate)** | Central ≈ 7–10 MB, State ≈ 55–70 MB, all in-force Acts ≈ 70–90 MB with term counts, delta + varint at ~1.6–2 bytes/posting **(estimate from the measured postings)**; section text served separately as JSON |
| Features | Stemming, phrase search, ranking, snippets/highlight, filters (act, state, year, status) in SQL, joins with users/Vault; **the same DB hosts pgvector** for hybrid ranking | Exact-word AND/OR, cheap; no stemming/phrases unless positions are stored (index ×3); no snippets without fetching chunk text; ranking is basic |
| Free-tier fit | Central + State Acts text ≈ 450 MB raw; with compression + GIN the total is roughly 350–500 MB **(estimate)**. **Supabase Free = 500 MB DB** (tight; paused after 1 week idle). **Neon Free = 1 GB per project**, scale-to-zero after 5 min. Regulators (+~600 MB text) do not fit either | Fits any static host: Cloudflare R2 free = 10 GB storage, free egress; Vercel Hobby ships 100 GB/month but is **non-commercial only** |
| Operational cost | ₹0 on free tiers (with the pause/cold-start caveats); $25/month Supabase Pro when it outgrows | ₹0 at this size; rebuild + upload on each data refresh |
| Risk | Free-tier ceiling; cold starts on Neon | Re-implementing ranking/phrases; two search systems when vectors arrive |

**Recommendation: (a) Postgres FTS**, because you need Postgres anyway for pgvector, Vault records, drafts and users, and hybrid keyword+semantic ranking is one SQL query there. Scope it so it fits: **Phase 1 loads Central Acts (all statuses) and State in-force Acts into Neon Free or Supabase Free**, leaving regulators for later. Keep (b) as the zero-cost fallback if you decide not to pay anything and want Phase 1 live before opening any account — it is already proven in this repo.

---

## 3. Semantic search plan

**Tokens to embed** (non-Devanagari characters ÷ 4 for English **(estimate)**; Devanagari is bounded by ≈1 token per character as a worst case **(estimate)**; includes the repeated `Act: … | Chapter … | Section …` header on every chunk).

| Scope | Chunks | Characters | Tokens (est.) |
|---|---:|---:|---:|
| A. Central Acts, in force | 57,020 | 59.3 M | **≈ 15 M** |
| B. Central Acts, all statuses | 71,488 | 73.6 M | ≈ 18 M |
| C. Central + State Acts in force | 475,443 | 452.5 M | **≈ 113–115 M** |
| D. C + regulator instruments (in force + superseded) | ≈ 971,000 | 1.0 B (46 M Devanagari) | **≈ 240–285 M** |

**Embedding options** (USD per 1M tokens from the vendors' pages today; INR at ₹96/USD — see FX note; free allowances subtracted; Voyage says batch usage does not draw from the free balance).

| Model | List price | Free allowance | Max input / dims | Cost scope A | Cost scope C | Cost scope D (upper token estimate 285 M) | Hindi / legal notes |
|---|---:|---|---|---|---|---|---|
| **voyage-4-lite** | $0.02 | 200 M tokens | 32k tokens; 1024 default, 256/512/2048 | ₹0 | ₹0 | ≈ ₹160 | "Multilingual" per Voyage; Hindi **not named**; no legal benchmark published on the page |
| **voyage-4** | $0.06 | 200 M | same | ₹0 | ₹0 | ≈ ₹480 | Same; "tuned for general-purpose and multilingual retrieval" |
| **voyage-law-2** | $0.12 | 50 M | 16k tokens; 1024 only | ₹0 | ≈ ₹730 | ≈ ₹2,700 | Described as tuned for legal retrieval; **no numbers or Hindi statement** on the docs page; float vectors only |
| OpenAI text-embedding-3-small | $0.02 | none | 8,192 tokens; 1536 (shortenable) | ≈ ₹28 | ≈ ₹220 | ≈ ₹545 | MTEB 62.3% (vendor page); MIRACL not stated |
| OpenAI text-embedding-3-large | $0.13 | none | 8,192; 3072 (shortenable to e.g. 1024) | ≈ ₹185 | ≈ ₹1,410 | ≈ ₹3,550 | MTEB 64.6% (vendor page) |
| Gemini `gemini-embedding-2` | $0.20 paid ($0.10 batch); free tier "free of charge" | free tier, limits **not stated** on the pages I read | 8,192 tokens; 128–3072 dims | free or ≈ ₹285 | free or ≈ ₹2,170 | free or ≈ ₹5,450 | "100+ languages", Hindi not named |
| BGE-M3 (open weights, MIT) | ₹0 licence; you pay compute | – | 8,192; 1024 | ₹0 on your Mac | ₹0 | ₹0 | "100+ languages" (page does not name Hindi); no hosted price checked — must be run locally or on a rented GPU; throughput on your Mac **unmeasured** |
| Cohere embed-multilingual-v3 | **price not found** on pricing pages | – | 1024 dims | unknown | unknown | unknown | Hindi supported per Cohere docs; I could not confirm the per-token price, so it is not costed |

**One-time vs monthly.** The one-time cost is the table above (re-run only when you refresh the dataset, about twice a year; a re-embed of scope C with voyage-law-2 would again be ≈ ₹730 once the free 50 M is spent). **Monthly** cost is just query embeddings: 100 users × 100 searches × ~40 tokens ≈ 0.4 M tokens ≈ **< ₹1/month** on any option **(estimate)**.

**Recommendation.** Use **voyage-4 at 256–1024 dimensions** as the working model because Central + State Acts embed inside the free 200 M tokens, and run a **bake-off against voyage-law-2 and OpenAI 3-large on ~50 real queries** (e.g. the three Section 138 questions plus statute-lookup and Hindi queries) before committing — no vendor publishes Indian-legal or Hindi results I could verify, so evidence must come from your own test. Exclude chunks with U+FFFD or mojibake Devanagari from the embedding run (U+FFFD: 1.4% of legislation and 5.8% of regulator chunks; mojibake Hindi: 0.4% and 7.5%) and strip markdown artifacts first.

**Where to store vectors: pgvector in the same Postgres.** Storage arithmetic (vector bytes only, **estimate**; HNSW indexes add a similar amount again):

| Scope | Chunks | 1024-d halfvec (2 KB each) | 256-d halfvec (0.5 KB each) |
|---|---:|---:|---:|
| A | 57 k | ≈ 117 MB | ≈ 29 MB |
| C | 475 k | ≈ 974 MB | ≈ 243 MB |
| D | ≈ 971 k | ≈ 2.0 GB | ≈ 0.5 GB |

Free-tier fit: **scope A fits any free tier** (Supabase Free 500 MB, Neon Free 1 GB; Neon states pgvector is included on all plans; Supabase's pgvector page I read does not state plan availability — **unverified**). **Scope C does not fit comfortably in 500 MB–1 GB** once text, GIN and HNSW are counted; it needs a paid plan, and its HNSW index should stay in RAM — a 1 GB Micro instance is too small for 1024-d, so use 256–512-d vectors or a larger compute size (Supabase Small $15, Medium $60 per month; ≈ prices from the compute page). Alternative: reusing the 1,098,577 vectors already on LAWSSD (1024-d dense + sparse in `acts_india`) — **not recommended for production**: the embedding model is undocumented in the dataset README, so queries could not be embedded compatibly, and the licence for the vectors themselves was not checked **(unverified)**.

---

## 4. Stack for the rest

| Need | Recommendation | Free-tier limits (vendor pages) | What you must set up | Monthly at ~100 users |
|---|---|---|---|---|
| **Google sign-in** | Supabase Auth with the Google provider (alternative: Auth.js, or Firebase Auth — 50 k MAU) | Supabase Free: **50,000 MAU**. Google: apps requesting only `openid`/email/profile show no warning, have no 100-user cap and no 7-day token expiry (the 100-test-user/7-day rules apply only to apps left in "Testing" or requesting other scopes) | A Google Cloud project; OAuth consent screen (set to **In production**); a Web-application OAuth client; your site origin + the Supabase callback URL as authorised redirect URIs; paste Client ID/Secret into Supabase. A custom domain is strongly advised, otherwise users see `<project>.supabase.co` on the consent screen | ₹0 |
| **Database** (users, drafts, Vault metadata, search) | Supabase Postgres (pgvector + FTS) | Free: 500 MB DB, 2 projects, pauses after 1 week idle. **Pro from $25/month**: 8 GB DB (then $0.125/GB), $10 compute credit covers a Micro (1 GB RAM); bigger compute costs more | Supabase account + project; later a card for Pro. (Neon is the cheaper-but-more-assembly alternative: Free 1 GB/project, pay-as-you-go $0.35/GB-month storage, $0.106/CU-hour compute, no monthly minimum) | Free until scope > central; then **≈ $25 ≈ ₹2,400**, +$5–50 for larger compute if vectors are big |
| **Vault file storage** | Supabase Storage (same auth/RLS) — or Cloudflare R2 | Supabase Free 1 GB, 50 MB max file; Pro 100 GB then $0.0213/GB, 500 GB max file. R2: 10 GB-month free, 1 M writes + 10 M reads free, free egress, then $0.015/GB-month | Create bucket(s) with per-user access rules; decide max file size/types and a retention policy | 100 users × ~100 MB ≈ 10 GB: ₹0 on R2 free, included on Supabase Pro |
| **Email when a draft is ready** | Resend | Free: **3,000 emails/month, 100/day**, 3 domains; Pro $20 = 50,000/month | **A domain you own** and its DNS records (Resend: you "must add and verify at least one domain"); API key | ₹0 (100 users × ~10 drafts ≈ 1,000 mails); Pro ≈ ₹1,900 only if you exceed 100/day |
| **Hosting** | Vercel (already used) | Hobby is **non-commercial only**; 100 GB bandwidth; 1 M function invocations; Pro $20/month | Decide whether LexBharat is commercial | ₹0 non-commercial, else **≈ ₹1,900** |
| **LLM for drafting** (not in your list, but Phase 3 needs it) | Claude API: Sonnet 5.5 $2 in / $10 out per MTok; Haiku 5.5 $0.10 / $0.50 per MTok (Batch API −50%) | no free tier | Anthropic API key and spend cap | A ~3,400-word draft with retrieval ≈ 20 k input + 6 k output tokens ≈ $0.10 (₹10) on Sonnet 5.5 **(estimate)**; 500 drafts/month ≈ ₹5,000 worst case, far less on Haiku |

**Total at ~100 users:** ≈ **₹2,400/month** (Supabase Pro) when non-commercial, **≈ ₹4,300/month** with Vercel Pro, **plus** LLM usage (₹0–5,000 depending on volume and model); embedding queries and email are effectively free. Domain registration cost not checked. Free-tier-only is possible for a central-Acts pilot but the Supabase project pauses after a week idle.

---

## 5. Build plan (phased)

Effort = focused working days for one developer pairing with Claude; elapsed time depends on your review turnaround.

**Phase 0 — data prep (W1, 2–3 days, no accounts).**
- *Build:* export script (DuckDB → Parquet/NDJSON) that (1) reassembles sections from `chunk_id` (`_sNNN`, `_pK`; rule for `_dK` variants and `_b` blocks decided and documented), (2) strips markdown/footnote markers, repairs letter-spacing, drops U+FFFD/mojibake chunks into a quarantine file with reasons, (3) writes one record per (act, section) with source URL, status, state, year.
- *You provide:* approval of the cleaning rules and the scope (A, then C).
- *Test:* golden sections (NI Act s138/s139/s142, a Maharashtra section, an RBI direction) must equal a hand-checked text; counts reconcile to 22,264 instruments / 318,135 sections; quarantine totals match §1.

**Phase 1 — Acts full text + keyword search, no AI (W1–W2, 5–7 days).**
- *Build:* section pages under the existing Acts browse (`/…/acts/<actId>/<section>`) rendering real text with in-force status, source link and an honesty banner ("extracted text; verify against the official source"); keyword search (Postgres FTS on Neon Free/Supabase Free for Central + State, or the static index fallback); filters for state/Act/year/status; deep links that the citation chips will use.
- *You provide:* a Postgres account (Neon or Supabase, free) and a connection string stored as a secret; decision (a) vs (b).
- *Test:* 30 scripted queries (exact phrases, section numbers like "Section 138", Hindi/Latin mix) with expected top-3 results; load test of the free tier; page checks for the garbled-text notice; no network call to any AI vendor.

**Phase 2 — semantic search (W3–W4, 6–8 days).**
- *Build:* embedding pipeline (resumable, batched), pgvector table + HNSW, hybrid keyword + vector ranking (reciprocal rank fusion), result cards with numbered chips and statute-name links ("Section 138" → the Phase 1 page, resolved from `acts_referenced` and a name parser), and the **Supported / Partly supported / Check sources** label plus an unsupported-claims list (verification step after retrieval; no percentages).
- *You provide:* a Voyage account/API key (free tokens apply; Voyage requires a payment method for higher rate limits — **your** decision), the bake-off sign-off, and the Pro-plan decision if scope C is chosen.
- *Test:* 50-question bake-off set (Section 138 trio included) scored top-5 recall against hand-picked sections for voyage-4 vs voyage-law-2 vs OpenAI 3-large; citation link resolution rate; label calibration on 30 answers you grade; cost log vs the estimates above.

**Phase 3 — Drafting (W5–W6, 6–9 days).**
- *Build:* template picker (general templates now, swappable later), prompt-to-draft flow with retrieval of relevant sections, queue + status polling, editor (rich text), export, placeholders highlighted; all India-only, no country switching.
- *You provide:* an Anthropic API key and spend cap, the real templates when ready.
- *Test:* five template types generated end-to-end; check cited sections exist; token/cost per draft; failure/timeouts handled.

**Phase 4 — Vault (W7, 4–5 days).**
- *Build:* Google sign-in (Supabase Auth), per-user storage bucket and metadata table, upload/list/preview/delete, size/type limits, private-by-default access rules, "documents are stored for you only" notice.
- *You provide:* the Google Cloud project/OAuth client, a production-mode consent screen, ideally the custom domain; storage limits.
- *Test:* two test accounts cannot see each other's files (access-rule tests); upload edge cases (50 MB, wrong type, interrupted); token refresh over >7 days.

**Phase 5 — Email when draft is ready (W8, 2–3 days).**
- *Build:* Resend integration triggered when a draft finishes, with a plain-text fallback and unsubscribe/notification preference.
- *You provide:* a domain, DNS records, Resend API key.
- *Test:* delivery to Gmail/Outlook inboxes, daily-limit handling (100/day), failure retry, no email when generation fails.

**Cross-cutting:** honesty banners on every page; no billing UI; single-user data model (no org/team tables); secrets only in the hosting provider's environment settings.

---

## 6. Open questions for you

1. Scope for v1 vectors: Central only (free), Central + State (needs Pro plan), or + regulators (largest, with the Hindi garbling)?
2. Will you spend ₹2,400/month once past the free tier, and is LexBharat commercial (Vercel Pro)?
3. Do you own a domain you can attach to Google sign-in and Resend?
4. Hindi: include garbled chunks with a warning, or exclude until re-extracted from the source PDFs?

## Appendix — how the numbers were produced

All queries ran with `duckdb` against `/Volumes/LAWSSD/open-india-law/in_*_legislation.parquet` and `in_*_regulations.parquet` (e.g. `count(DISTINCT (act_id, section_number))`, `regexp_matches(text,'[ऀ-ॿ]')`, `contains(text, chr(65533))`, reassembly check grouping `_pN` suffixes). Counts for 1.1 M rows run in 5–20 seconds. FX: ₹96/USD is an **approximate** rate — I could not retrieve today's RBI reference rate (latest found: ₹96.29 on 18 May 2026, ≈₹95.95 market quote mid-September 2026); recompute INR figures at the actual rate on the day you pay.

## Sources (prices and documentation checked 2026-10-22)

- Voyage pricing: https://docs.voyageai.com/docs/pricing · models: https://docs.voyageai.com/docs/embeddings · rate limits: https://docs.voyageai.com/docs/rate-limits
- OpenAI pricing: https://developers.openai.com/api/docs/pricing · embeddings guide: https://developers.openai.com/api/docs/guides/embeddings
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing · embeddings: https://ai.google.dev/gemini-api/docs/embeddings · rate limits: https://ai.google.dev/gemini-api/docs/rate-limits
- Cohere: https://cohere.com/pricing and https://docs.cohere.com/docs/cohere-embed (no per-token embed price found)
- BGE-M3: https://huggingface.co/BAAI/bge-m3
- Supabase pricing: https://supabase.com/pricing · compute: https://supabase.com/docs/guides/platform/compute-and-disk · Google sign-in: https://supabase.com/docs/guides/auth/social-login/auth-google · pgvector: https://supabase.com/docs/guides/database/extensions/pgvector
- Neon pricing: https://neon.com/pricing
- Resend pricing: https://resend.com/pricing · domains: https://resend.com/docs/dashboard/domains/introduction
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Vercel pricing: https://vercel.com/pricing
- Firebase pricing: https://firebase.google.com/pricing
- Google OAuth app audience/verification: https://support.google.com/cloud/answer/15549945
- Anthropic pricing: https://platform.claude.com/docs/en/about-claude/pricing
- USD/INR: https://www.msei.in/markets/currency/historical-data/rbireferenceratearchives (archive; not today's rate)
