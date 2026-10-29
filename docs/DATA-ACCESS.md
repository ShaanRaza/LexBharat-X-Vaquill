# Data access: swapping the legal data source

Search, Ask, Drafting, the law pages, the judgment pages and the quick-find all read Acts and judgments through **one module: `src/lib/legal-data/index.ts`**. Nothing in the UI or the answer logic names a table, a SQL statement, a data directory or a vector store. To plug in a new dataset, change that module (and the folders it wraps), not the screens.

## What the module provides today

| Need | Function(s) | Used by |
|---|---|---|
| Search sections (keyword, meaning, exact lookups) | `searchSections`, `primeSemanticQueries`, `PAGE_SIZE` | search page and API, Ask retrieval |
| Section text for many sections | `sectionBodies(refs, maxChars)` | Ask (the sources the model sees), Drafting (re-load a draft's basis) |
| One section with its Act | `sectionDetail(actId, sectionKey)` | the cited page beside an answer |
| An Act's text, contents, status | `loadActText`, `getActsStore`, `getSectionsStore`, `parseActsQuery` | law pages, Library, Acts API |
| Regulator instruments | `searchRegulators` | search API |
| Judgments: lists, years, cases | `getJudgmentsStore`, `scCase` | Library, judgment pages, quick-find |
| Judgment text and search | `getCaseText`, `judgmentExcerpt`, `searchSupremeCourt`, `searchHighCourts`, `searchJudgmentsByMeaning`, `searchJudgmentsByWords` | judgment page, Ask (judgment excerpts), search |
| "Laws referred to" in a judgment | `resolveMentions`, `lawsReferred`, `sectionPresence` | judgment page |
| Quick-find numbers ("138 NI Act") | `numberedLaws` | quick-find |
| Is section text available at all | `legalDataConfigured`, `sectionTextAvailable` | pages that word a notice |

Today these are backed by Neon (Acts), the Supreme Court database, the vector database and local files (`src/lib/acts`, `src/lib/judgments`, `src/lib/sections`). A new source implements the same functions (same names, same return shapes, see the `export` lines and the types in `src/lib/acts/types.ts` and `src/lib/judgments/types.ts`).

## What is NOT in the module

The app's own tables (saved chats, drafts, reviews, usage counters, the gap log) use `src/lib/app-db.ts`. If the legal data moves to a different database, keep that connection: `app-db.ts` currently re-exports the same Neon connection.

## How the boundary is enforced

`src/lib/legal-data/boundary.test.mjs` (runs with the other tests) fails when:
1. code outside `src/lib/legal-data`, `src/lib/acts`, `src/lib/judgments`, `src/lib/sections` or `src/lib/supplement` runs SQL on a legal-data table (`act_sections`, `acts`, `act_missing_sections`, `sc_cases`, `reg_sections`, `reg_acts`), or
2. any file outside those folders imports a concrete store directly instead of `@/lib/legal-data` (or `@/lib/app-db`).

Pure helpers (`.mjs` files for query parsing, labels, citations, provenance text) are logic, not data access, and stay importable from anywhere.

## Things a new dataset must keep working

- The section keys and numbers the links use (`/law/<actId>/<sectionKey>`), the `status` of a section (complete / possibly incomplete / garbled), and the Act status (in force / repealed) that the answer logic reads.
- The "known missing" and "supplement" tables are used only to say "this section isn't in our library yet"; a complete dataset makes them empty.
- Embeddings: search by meaning and Ask use stored vectors per section (`src/lib/acts/vectorStore.ts`, Voyage). New text needs new vectors.
- `docs/eval/` (scorecard) finds the expected sections by Act title and a phrase of the section text; re-run it after any data swap.
