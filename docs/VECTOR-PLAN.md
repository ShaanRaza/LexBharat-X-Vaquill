# Semantic search plan (measurements only, nothing embedded yet)

Written 2026-10-23. Nothing was embedded and no embedding account was created. The vector database is a **separate, empty Neon project** (`VECTOR_DATABASE_URL`, never printed or committed); the section-text database (`DATABASE_URL`) is untouched.

## 1. Vector database
| Check | Result |
|---|---|
| Server | PostgreSQL 18.6 |
| pgvector | **0.8.6**, enabled with `CREATE EXTENSION vector` |
| `halfvec` | **Supported** (type present; `halfvec_cosine_ops` available for HNSW) |
| Size before / after my tests | 7.5 MB empty; test tables were dropped (database size reads 190 MB until Neon reclaims it; 0 tables remain) |
| Plan limit | Neon Free: 1 GB Postgres storage per project (neon.com/docs/introduction/plans, checked 2026-10-23) |

## 2. Chunks (Central + State Acts, English display text, no garbled or Hindi-only text)
`npm`-free measurement: `node scripts/acts/plan-chunks.mjs` (rule in `src/lib/acts/chunking.mjs`: one context line `Act (year) — Section N — heading` plus the text, cut on paragraph then sentence boundaries at about 1,800 characters, never above about 2,400).
| | |
|---|---:|
| Sections with text | 209,733 |
| **Chunks** | **353,391** (Central 58,109; State 295,282) |
| Average chunk | 1,213 characters (about 303 tokens, chars ÷ 4, an estimate) |
| Median / 90th percentile / max | 1,282 / 1,893 / 2,628 characters |
| Chunks under 300 characters | 14,008 (short sections; kept so every section can be found) |
| **Total to embed** | **about 107 million tokens** (estimate; the vendor's own tokenizer will differ, so plan for 90 to 160 M) |

## 3. Storage (measured, not guessed)
I inserted 20,000 synthetic rows per size into the vector database (table: id, act id, section key, part, `halfvec(N)`), built an HNSW index (`m=16, ef_construction=64, halfvec_cosine_ops`), read the sizes, scaled to 353,391 chunks and dropped the tables.
| Dimensions | Table (per 20k rows) | HNSW index (per 20k rows) | **Table, full** | **HNSW, full** | **Total, full** | Fits 1 GB with room? |
|---|---:|---:|---:|---:|---:|---|
| 1024 | 54.6 MB | 50.8 MB | 965 MB | 898 MB | **about 1.87 GB** | **No** |
| 512 | 22.4 MB | 25.4 MB | 396 MB | 449 MB | **about 0.85 GB** | Only just (85%, no room to grow) |
| **256** | 12.1 MB | 15.4 MB | 214 MB | 272 MB | **about 0.49 GB** | **Yes (about 50%)** |
The primary-key index adds about 7 MB. The vector table stores only ids and the vector; the chunk text stays in the section-text database and is fetched for the hits.
**Choice: 256 dimensions (halfvec).** Cost: lower recall than 1024. Mitigation: re-rank the top 50 hits with the existing keyword score, and decide with the 50-question test (below) before loading everything.
An HNSW index of this size also wants to sit in memory for fast queries; Neon Free computes are small (up to 2 CU = 8 GB RAM at most, scale-to-zero after 5 minutes), so expect a slow first query after a pause.

## 4. Embedding model (official pages checked 2026-10-23)
Prices per million tokens; INR at an **approximate** ₹96 per US dollar (I could not retrieve today's RBI rate); estimated 107 M tokens.
| Model | Price | Free allowance | Dimensions offered | One-time cost for this corpus |
|---|---:|---|---|---|
| **voyage-4** | $0.06 | 200 M tokens | 2048, 1024, 512, **256** | **₹0** if the estimate holds (107 M is 54% of the free tokens); if it were 250 M tokens, about ₹290 |
| voyage-4-large | $0.12 | 200 M tokens | same | ₹0 within the free allowance; about ₹580 beyond 250 M tokens |
| voyage-4-lite | $0.02 | 200 M tokens | same | ₹0 within the free allowance |
| voyage-law-2 (legal) | $0.12 | 50 M tokens | **1024 only** | about ₹660 (57 M paid tokens), and 1024 does not fit 1 GB |
| OpenAI text-embedding-3-small | $0.02 | none | 1536, shortenable | about ₹205 |
| OpenAI text-embedding-3-large | $0.13 | none | 3072, shortenable | about ₹1,335 |
Voyage says embeddings from the whole 4 series are compatible with each other, so documents can be embedded once with one model and queries with a cheaper one (for example voyage-4-lite), and Batch API usage gets 33% off but does not use the free tokens. Voyage's pages do not state rate limits for accounts without a payment method (Tier 1 requires adding one), so loading 107 M tokens may need a payment method on file; that is your decision, nothing was signed up.
**Recommendation:** embed with **voyage-4 at 256 dimensions** (free inside the allowance, fits the free storage), query with voyage-4-lite or voyage-4. First run a bake-off on the Central Acts only (58,109 chunks, about 17 M tokens, also free) comparing voyage-4 @256, voyage-4 @512 and voyage-4-large @256 on the 50 questions; pick by top-5 hit rate. Voyage and OpenAI publish no Indian-law or Hindi benchmark I could verify, so only this test can decide.
Links: https://docs.voyageai.com/docs/pricing · https://docs.voyageai.com/docs/embeddings · https://developers.openai.com/api/docs/pricing · https://neon.com/docs/introduction/plans

## 5. Test set
`docs/search-eval/questions.json`: 50 realistic questions (cheque bounce, contracts, BNS, bail, arbitration, limitation, property, company law, IT, RTI, motor vehicles, gratuity, marriage, succession, consumer, partnership, sale of goods), each with the Act, the section it should find and a phrase from the statute (`anchor`). A result is a hit when it belongs to that Act and contains the anchor. All 50 were checked against the data in Neon: the anchor is present, under the expected section number (4 of those sections are flagged possibly incomplete).
**Baseline:** the current keyword search on the 50 questions typed as plain sentences gets the expected section in the top 1 for **7 of 50** and in the top 5 for **13 of 50** (26%); 5 questions return no result at all (every word must match). Semantic search has to beat that clearly.
**Gaps found while building it (data, not search):** Code of Civil Procedure 1908 sections 11 and 20 are not in the data (those numbers hold Order/rule text); the Limitation Act 1963 has only 43 sections (4, 5 and 7 to 10 are missing); Indian Contract Act sections 16, 73 and 124 are missing. Questions about those were replaced, so they are not testable until the source text is fixed.
