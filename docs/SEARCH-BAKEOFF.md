# Semantic search bake-off: PILOT result (not the full test)

Run 2026-10-23. **This is a pilot, and it is easier than the real task.** The real test (all 58,109 Central Act chunks) has not run: the Voyage account has no payment method, so it is limited to 3 requests and 10,000 tokens per minute, and the full run would take about two days (see "Why not the full run").

## What was tested
- **Corpus (pilot):** 1,281 chunks = every section that answers one of the 50 questions (45 sections) **plus 700 random other Central sections as distractors** (745 sections in all, about 0.4% of the 58k-chunk Central corpus). The answers were put into the sample on purpose, so the pilot is much easier than searching all Central Acts: the answer is one of 745 sections, not one of about 40,000.
- **Embeddings:** voyage-4, documents embedded once at 1024 dimensions; the 512 and 256 versions are the same vectors cut to length and renormalised (checked on real vectors: cosine 1.0000 against Voyage's own 256-dimension output, so nothing is lost by deriving them). Stored as `halfvec` with HNSW indexes (m=16, ef_construction=64, ef_search=100).
- **Questions:** the 50 in `docs/search-eval/questions.json`. A hit means a gold section is in the top K sections (a gold section = a Central Act section containing the question's anchor phrase). Keyword search was limited to the same 745 sections.
- **Tokens used:** 463,463 for the 1,281 chunks (about 362 tokens per chunk, more than the 303 I had estimated from characters) plus about 600 for queries: about **0.47 million tokens**, far below the 30M cap. Rate-limit retries: 17.
- **Timing:** from this Mac to Neon (Singapore/US region unknown) and Voyage; indicative only. One query embedding takes about 1.1 to 1.5 s (measured with single requests; the evaluation run itself was slowed to 38 s by the rate limit, so I use the unthrottled figure).

## Results (pilot corpus, 50 questions)
| Setup | Top 1 | Top 5 | Top 10 | No result | Search time (embedding 1.1 s + database) |
|---|---:|---:|---:|---:|---:|
| Keyword AND (today's search) | 32% | 34% | 34% | 33 | 0.13 s |
| Keyword OR (any word, ranked) | 26% | 64% | 80% | 5 | 0.43 s |
| Semantic 1024 | 84% | 90% | 90% | 5 | about 1.25 s |
| Semantic 512 | 86% | 90% | 90% | 5 | about 1.24 s |
| **Semantic 256** | **86%** | **90%** | **90%** | 5 | about **1.23 s** |
| Hybrid 1024 (semantic + keyword OR, reciprocal rank fusion) | 60% | 86% | 90% | 5 | about 1.7 s |
| Hybrid 512 | 62% | 88% | 90% | 5 | about 1.7 s |
| Hybrid 256 | 64% | 88% | 90% | 5 | about 1.7 s |
The database part of a semantic search is about 0.09 to 0.10 s at every size; almost all the time is the Voyage call for the question.

## What the pilot does and does not tell us
- **Reliable enough to act on:** the three sizes are equal (84 to 86% top 1, 90% top 5), so **256 dimensions loses nothing** here and needs half the storage of 512 and a quarter of 1024 (about 0.49 GB for all Central + State chunks, see `docs/VECTOR-PLAN.md`). Plain semantic search beats today's keyword search by a wide margin (86% against 32% top 1).
- **Not reliable:** the absolute numbers. On the full corpus there are about 50 times more competing sections, so every rate will be lower, and hybrid might look different. The five questions with no result are **unanswerable in a Central-only corpus**, not search failures: four CrPC questions (anticipatory bail s438, bail s437, default bail s167, FIR s154) because the Code of Criminal Procedure, 1973 has no Central entry in the data (its copies are filed under States), and the gratuity question because that Act is also not among the Central entries. Counting only the 45 answerable questions, semantic 256 puts the right section first for 43 (96%) and in the top 5 for all 45; the table above divides by 50 as agreed.
- **Hybrid was worse than semantic alone in this pilot** because the keyword leg is weak (OR of all question words, ranked by `ts_rank_cd`); fusion pulls noisy keyword hits above correct semantic ones. A better keyword leg (phrases, stemmed key terms) was not tried.
- **Provisional recommendation (to be confirmed on the full corpus): semantic only, `voyage-4`, 256 dimensions, `halfvec` + HNSW**, with the current keyword search kept for exact words, quotes and "138 NI Act" lookups (those work well and are fast). Do not ship hybrid fusion until it beats semantic alone on the full test.

## Why not the full run
Central Acts are 58,109 chunks, about 21 million tokens at the measured 362 tokens per chunk. The account allows 10,000 tokens a minute; in the pilot I achieved about 6,500 to 9,000 effective (limited by 3 requests a minute and the 10K per-request ceiling). That is **about 39 to 54 hours**, over your 3-hour limit, so I stopped. Adding a payment method on Voyage's billing page lifts the limits (the first 200 million tokens stay free), and the whole run would then take roughly 30 to 60 minutes. Commands, once unlocked:
`node scripts/acts/bakeoff-chunks.mjs` then `node scripts/acts/bakeoff-embed.mjs` then `node scripts/acts/bakeoff-load.mjs emb` then `node scripts/acts/bakeoff-eval.mjs emb` (resumable; files in `../lexbharat-data/vectors`, outside the repo).

## Clean-up
The 1024 and 512 pilot tables were dropped; only `emb_256` (pilot, 1,281 rows) remains. Vector database size after: **9.9 MB** (7.5 MB empty).
