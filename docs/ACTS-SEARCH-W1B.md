# W1b: keyword search over Act section text (Neon Postgres)

Added 2026-10-23. Data: open-india-law `v2026.08` (CC BY 4.0), Central and State/UT Acts, built by W1a (`docs/ACTS-TEXT-W1A.md`). Regulator instruments are not loaded.

## Step 0: is "mixes piece kinds" really broken?
Sample: 20 random sections whose ONLY problem flag is `mixed_structure` (pool of 23,943 sections; seeded draw), read piece by piece in reading order.
| Reads correctly | Minor extra text (a stray heading at either end) | Materially broken |
|---:|---:|---:|
| 7 | 3 | 10 |
Broken ones had foreign text inside the section (a contents list, another section's amendment, the next section's sub-sections, rules mixed with the Act), repeated clauses, doubled OCR words, or sub-sections out of order. Most of them contain a stray bare `sNNN` piece next to `_pN` pieces. Most do **not** read correctly, so the reason stays `possibly_incomplete`; flag counts are unchanged. (India Code was not opened; the texts were read directly.)

## Neon load (`npm run load:acts-neon`, about 100 s)
| | |
|---|---:|
| Acts | 10,112 |
| Sections (rows) | 211,553 (209,734 with text; 1,819 garbled or Hindi-only rows keep a row but **no text**) |
| Database size | 686 MB |
| `act_sections` table (heap + toast) | 555 MB (body about 214 MB compressed, stored `tsvector` about 268 MB) |
| GIN full-text index | 102 MB (all indexes 120 MB) |
Neon Free allows 1 GB of Postgres storage per project (checked on neon.com/docs/introduction/plans, 2026-10-23): this uses about 67%, leaving about 330 MB. It fits, but there is no room for embeddings in the same project; the semantic-search phase needs a paid plan or a different vector store.

## Full-text configuration
`english`, not `simple`. The text is English legal prose, so stemming matters ("dishonoured" finds "dishonour", "cheques" finds "cheque") and stop-word removal makes the index smaller. Cost: stems can over-match ("universities" and "university"), and quoted phrases still need the same stems in the same order. Headings weigh more (A) than the body (B). Hindi pieces are not loaded, so Hindi queries return a clear "not searchable yet" message.

## API: `GET /api/acts/search?q=&page=`
12 results per page (up to 1,000 matches can be paged), fields `results, total, totalCapped, page, pageSize, hasMore, note` like `/api/judgments/search-hc`. Each result: Act, section number and key, heading, chapter (only if verified), highlighted snippet (private-use markers), quality status and flags, `via: "text" | "lookup"`. Input: 2 to 200 characters (422 otherwise). Supports plain words (all words must appear), `"exact phrase"`, `or`, `-word` (Postgres `websearch_to_tsquery`), and section lookups such as `138 NI Act`, `section 10 contract act`, `NI Act s. 138` (aliases for common Acts in `searchQuery.mjs`; other Acts are matched by the words of their title). Without `DATABASE_URL`: HTTP 200 with `searchAvailable: false`.

## Where the pieces are
`src/lib/acts/db.ts` (Neon client; the only reader of `DATABASE_URL`), `searchQuery.mjs` (parsing, tested), `searchStore.ts` (SQL), `highlight.mjs`, `actText.ts` (Act pages: Neon, then local files, then "not available yet"), `src/app/api/acts/search/route.ts`, `src/components/workspace/SectionSearchResults.tsx`, shared `src/components/kit/Highlight.tsx`. Schema and loader: `scripts/acts/neon-schema.sql`, `neon-indexes.sql`, `build-neon-csv.mjs`, `load-neon.sh`.

## Limits
Broad words ("section") match thousands of rows; they are ranked within the first 1,000 matches and take about 0.8 s. Ranking is `ts_rank_cd` (no semantic understanding). Sections flagged `possibly_incomplete` are searchable and show their flag. No Vercel environment variable was set; production keeps showing "not available yet" until `DATABASE_URL` is set there.
