# Audit of six bug classes (Oct 29, 2026)

Rule followed: a reported bug is an example of a class (CLAUDE.md). For each class: the general cause, every place found, the shared fix, the automated check, the counts.
Re-run the data checks with `node scripts/audit/clean-check.mjs`, `node scripts/audit/title-check.mjs`, `node scripts/audit/ui-scan.mjs`; the unit checks run with `npm run test:extract` (`src/ui-audit.test.mjs`, `src/lib/text/clean.test.mjs`, `src/lib/docs/docType.test.mjs`, `src/lib/chat/shape.test.mjs`).

## 1. Source text shown raw

**Cause:** each page cleaned (or did not clean) the data's text its own way; there was no shared display layer.

**What the data contains** (`scripts/audit/junk-scan-acts.mjs`, `junk-scan-judgments.mjs`; raw counts in `docs/audit-junk-*.json`):

| Junk | Act sections (211,315) | Regulator sections (104,547) | Judgments (35,596) |
|---|---:|---:|---:|
| `==> picture ... omitted <==` placeholders | 3,867 | 5,872 | 1 |
| amendment numbers `4[words]` | 21,379 | 10,304 | 5,178 |
| footnote references `[1] [( 1 )]` | 20,435 | 2,123 | n/a |
| markdown (`**`, `_x_`, `##`, `>`) | 130,741 / 52,034 / 40,033 / 30,059 | 49,316 / 13,072 / 35,972 / 8,592 | 1,225 / 312 / 102 |
| HTML tags or entities | 6,080 | 11,187 | 71 |
| lost characters (U+FFFD) | 1,470 | 819 | 97 |
| spaced brackets `( a )` | 1,522 | 227 | 2,892 |
| literal backslash escapes | 922 | 197 | 2,096 |
| control characters | n/a | n/a | 254 |
Also seen: running heads in judgments ("SUPREME COURT REPORTS", 10,633 judgments; "The Judgment of the Court was delivered by", 20,637): kept, they are the printed report's furniture.

**Places that showed source text** (all found): the law page blocks; the Ask cited page paragraphs; Search snippets (Acts: 4 builders; regulators: 2); Ask source previews; the text the answer model reads (it saw `4[...]` numbers that look like citation numbers); the judgment reader and its opening-text preview; the Vault preview (per page); review quotes; the shared Highlight component; and headings, chapters and previews printed in 19 places in 6 components (law page contents, Constitution contents, search results, Ask source rows, cited page, drafting basis).

**Fix, once:** `src/lib/text/clean.mjs` (junk removal, markdown, spacing, joined words, amendment numbers as footnote marks in reading views and dropped in plain text) and `src/components/text/DisplayText.tsx`. Every site above uses it; the data layer returns display-clean section text (`sectionBodies`) and snippets.

**Checks:** `clean.test.mjs` (synthetic samples of every pattern); `RESIDUE` patterns (`src/lib/text/residue.mjs`); `clean-check.mjs` samples random real texts: 6,060 sampled, 10 (0.17%) still show a bracket or spacing oddity, all inside text that is itself garbled OCR; rule R9 in `src/ui-audit.test.mjs` fails if a data text field is printed without the layer (it found 19, now 0).

## 2. Every document treated as an Act

**Cause:** unit words came from the number alone ("Section N" by default), the source link was always India Code, titles were printed as stored.

**Found:** 9 places that built "Section N" or called `sectionWord` (search results, Ask source rows, cited page, drafting basis, review blocks, the answer prompt, the missing-section sentences, the law page heading and counts, source labels); 6 places that sent a reader to India Code whatever the document was (law page, its notices, search notices, missing-section notice); 22,265 titles of which 3,453 looked wrong (all lower case, ALL CAPITALS, `Advisory022026`, `%20`, underscores, hyphen-joined, `01July2017`).

**Fix, once:** `src/lib/docs/docType.mjs` (document type, unit word, source link and its name, title tidying) with `src/config/acronyms.json`. Titles leave the data layer display-ready (search, regulator search, Acts list, quick-find, cited page). A regulator instrument with no link shows no link, not a wrong one (4,107 of 12,152 have none).

**Checks:** `docType.test.mjs`; `title-check.mjs` runs all 22,265 titles (3,453 wrong before, 0 after); the UI audit fails on `sectionWord(` or a hard-coded "Section" before a number in any screen.

## 3. Looks clickable but is not / clickable but does not look it

**Cause:** pages styled their own controls.

**Found by a parser-based scan of every screen (`scripts/audit/ui-scan.mjs`, rules R1-R7):** 7 hits: the error page (button without a type, unstyled button and link: 3), the user menu's "Log out" (the whole row reacted to hover but only the words were a button), 2 result cards whose title link stretches over the card (false positives, the rule now knows the pattern) and the Quick-find option rows (a listbox pattern, now known). 5 real, 2 recognised patterns.

**Fixed:** the error page uses the shared Button; "Log out" fills its row. **Check:** `src/ui-audit.test.mjs`.

## 4. Layout overlap

**Cause:** sticky offsets were typed per page and the header's real height (bar plus testing banner) was not known to the rest of the page.

**Found:** 4 sticky columns that stuck under the header (law page contents and notes, judgment margin, Ask cited page used a different value, legal-page contents `top-24`); no page-wide scroll offset, so anchors, `scrollIntoView` (judgment reader 4, vault 1) and keyboard focus could land under the header (3 places patched it per element with `scroll-mt-24`); a fixed bottom padding on every page.

**Fix, once:** the header publishes its height (`StickyHeader`, `--header-h`); `html { scroll-padding-top/bottom }` and the Tailwind names `top-header` and `pb-page-bottom` in the tokens. **Check:** the layout test in `src/ui-audit.test.mjs` fails on any numeric sticky top, any per-element scroll margin or a fixed padding on `<main>`.

## 5. Leftovers from the old design

**Found:** "Browse Laws & Judgments" (court page breadcrumb), "chat" in 6 user-visible strings (Ask loading and not-found messages, the Desk's fallback title, the Vault intro, the admin table, the Privacy text x3), 7 unused exports of the old marketing component file, 4 stale comments naming `/workspace/...` addresses. Not touched: the old `PageHero` and `DataNote` still serve the Terms, Privacy and Security pages (Phase 7 replaces them) and the redirects keep the old addresses on purpose.

**Fixed; check:** the wording test in `src/ui-audit.test.mjs` fails on "Browse Laws", "Workspace", "Developer console", "Playground" and "a/your/this chat" in any screen text.

## 6. Answer quality

**Found (stored evaluation answers, 190):** 8 whose top sources contained the same section twice (a second Act record of the same law: IPC 302, 498A, 379, Arbitration s.7); 19 that open with a hedge; 0 that repeat a citation inside a sentence; 84 with a "Related provisions" list (not measurable without a per-question list).

**Fix, shared:** `dedupeCopies` removes a section filed twice from Ask's sources and from every Search result; `src/lib/chat/shape.mjs` (answer first, related provisions only if they apply, a citation once per sentence) behind the `currentLaw` and `citationCheck` switches, to be evaluated with (c) and (d). The scorer now counts duplicate citations, duplicate sources and hedges on every question and marks an answer with any of them not right (`scripts/eval/e2e.mjs`).

## Browser sweep (`npm run ui-sweep`), Oct 29, 2026

Run before every push. It starts its own server (`scripts/ui-sweep/serve.sh`, port 3300: no AI keys, no Supabase, nothing written, no model quota; Ask is answered from a canned stream with real sections) and opens 27 page types in Chrome at 1280 px and 375 px: Desk, Ask (empty; with an answer and the cited panel, on a phone the bottom sheet opened), Search (Laws, Judgments, Your documents, and Laws and Judgments with meaning search busy: the fallback notice must be on the page), Library (overview, Acts, Constitution, Regulators, Judgments, a court), a law page, an Act, a regulator document, a judgment, Work (Drafts, Reviews, Vault), Terms, Privacy, Security, the password page, the error page, the 404 page. It also opens 3 addresses of every kind of link found (69 of 853) to see that none leads to an error.
Checks: **hidden** (under the header or the tab bar: at the top, at the bottom, after keyboard focus, sticky columns), **hscroll**, **raw** (the display layer's residue list plus programming leftovers, and per-page rules: a regulator document must not mention India Code or say "Section"; a case name must not end in "versus"), **wording** (old design, developer wording, "placeholder"), **clickable** (pointer cursor on a non-control, links to nowhere, nameless buttons, links to error pages), **console** (console errors, failed requests, broken images). A self-test page with one planted defect per check runs first: if the sweep stops seeing one it fails before looking at the app. Exceptions go in `scripts/ui-sweep/allow.json`, each with a reason. Screenshots: `.ui-sweep/<viewport>/<page>.png` (not committed).

### What the first runs found (all fixed in shared code; each class now has a check)

| Class | Places | Cause and fix | Check |
|---|---:|---|---|
| A sticky column taller than the screen is cut off at the bottom (Act contents list, notes, judgment margin, Ask cited page, legal-page contents) | 5 | each sticky column set its own height; `max-h-sticky` (Tailwind) = screen minus header, scrolls inside | `ui-audit.test.mjs` fails on `sticky` + `top-header` without `max-h-sticky` (it found the 5th, `LegalView`, after I had fixed 4); the sweep measures every sticky element |
| B a regulator document dressed as an Act: breadcrumb "Library > Acts", "Open the original on India Code", "N filled in from India Code", "compiled from India Code" | 4 on the law page | `sourceInfo` accepted India Code for any document; `libraryHome(doc)` gives the Library tab; provenance and counts say what is true for the type | `docType.test.mjs`; sweep rules on the regulator page |
| C a case name that ends in "versus" or "v. ." because a party is missing | every judgment list, search, case page (all courts) | `caseTitle` and punctuation-only parties dropped, once, in `getJudgmentsStore` and the Supreme Court index rows | `docType.test.mjs`; sweep rule on Search/judgment pages |
| D half an emphasis mark left in a snippet ("ibid_") and runs of dashes ("------for") | all text through the display layer | `stripMarkdown` in `src/lib/text/clean.mjs`; two new patterns in `residue.mjs` | `clean.test.mjs`; sweep raw check |
| E developer wording on a user page ("restart the dev server" on the error page) | 1 | reworded; "dev server" and "placeholder" added to the old-wording list (`scripts/ui-sweep/rules.mjs`, shared with the unit audit) | `ui-audit.test.mjs`; sweep wording check |

Not fixed, listed in `allow.json` or here: Terms, Privacy and Security still say "recreated placeholder" (Phase 7 replaces them); on a phone the tab rows (Search, Library) scroll sideways and the first or last tab can show cut off (by design, no hint that more is there); `2 texts still show junk` in `clean-check` (garbled OCR); the Vault page showed "not set up" because the sweep server has no storage.

## Search by meaning: stored vectors, and silent fallback (Oct 30, 2026)

Re-run the checks with `npm run verify-vectors` (read-only; one Voyage request) and `node scripts/eval/vector-share.mjs`.

### Do the stored vectors match the query embedding?
Yes. Queries: voyage-4, 256 dimensions, input_type "query" (`src/lib/acts/embed.ts`: `VOYAGE_MODEL`, `EMBED_DIM`; the store asks for its own size, `vectorStore.ts`: `NEON_DIM = 256`). Stored: every table is `halfvec(256)` (`scripts/verify/dims.mjs`: central about 77k rows, state 462k, supplement 3k, regulatory 515k, Supreme Court 366k). They were made by the dataset's voyage-4 at 1024-d, truncated to 256 and renormalised (`export-*-vectors.mjs`, `load-qdrant-vectors.mjs`: Matryoshka, the same as asking for 256), and the gap-fillers by voyage-4 at 256 (`embed-missing.mjs`, `load-supplement.mjs`). Measured (`scripts/verify/model-check.mjs`: 3 stored passages per corpus re-embedded with voyage-4/256 and compared with the stored vector): cosine 0.93-0.95 central, 0.99 state, 0.89-0.98 regulatory, 0.87-0.90 Supreme Court, against 0.12-0.46 for random stored vectors. A different model or size would sit at the random level. The lower Supreme Court and regulatory figures are most likely chunk text that is not byte-identical to the dataset's own chunks (not checked chunk by chunk); either way they are far above the random level.

### Vector search alone gives the right sections (`scripts/verify/vector-only.mjs`: the app's own embedding and stores, no keywords, synonyms, boosts or lookups)
| Query | Expected | Rank |
|---|---|---|
| punishment for stealing | BNS 303 / IPC 379 | IPC 379 at 2, BNS 303 at 5 (a draft-stage BNS record at 1) |
| notice after cheque bounces | NI Act 138 | 5 (s.106, 93, 85, 30 above it: all NI notice and drawer sections) |
| time limit for filing a consumer complaint | Consumer Protection Act limitation | 1 |
| bail for a non-bailable offence | CrPC 437 / BNSS 480 | 2 |
| cruelty by husband or his relatives | IPC 498A / BNS 85 | IPC 498A at 1, BNS 85 at 3 |
| insider trading disclosure obligations of promoters (regulators) | SEBI PIT Regulations | 1 |
| right to privacy is a fundamental right under Article 21 (Supreme Court) | the privacy judgment | 2017_INSC_801 at 1 |
Expected section in the top 3: 5 of 6 (the miss is NI Act s.138, at 5, behind four other NI Act notice and drawer sections); top 10: 6 of 6. The privacy question is judged by eye. Raw vector hits repeat a section filed under several Act records; the app folds those (`dedupeCopies`). The ranking the reader sees adds keyword lift, synonyms and current-law-first on top of this.

### Quick-find does not use vectors
`useQuickFind.ts` and `useDesk.ts` always ask `/api/acts/search` for `exact=1`; `quickLaws.ts` is exact SQL. (The class test checks this.)

### What fell back silently (found)
| Where | Before | Class cause |
|---|---|---|
| Search, Acts | `catch` set a reason; a muted line of text; no log, no count; **the response was cached by the CDN for 5 minutes (stale 1 hour) like a normal one**, so one Voyage 429 was served to everyone searching that query | each path caught the error its own way |
| Search, Regulators | `catch {}`: no reason, no note, no log | same |
| Search, Supreme Court text | error shown, no log; no fallback to words although the word index exists | same |
| Ask retrieval (sections, case passages) | silent; the answer was built on keyword results with no word to the reader | same |
| Ask, your own documents | silent `catch` | same |
Not a fallback: Ask's second keyword pass (`exact: true`) is by design.

### Fix, once
`src/lib/acts/meaning.mjs` (pure: why it failed, what the reader is told, whether it may be cached, the stats), `meaningLog.ts` (a `[meaning-fallback]` log line per fallback: surface, cause, safe detail, never the query or a key; counters in `usage_daily` as `meaning_search` / `meaning_fallback`, no schema change; in-process counters). Every search path calls `meaningUsed` or `meaningFellBack`. The reader sees "Showing exact-word results — meaning search is busy." (Search, all tabs; Ask says the sections were found by exact words only); a fallback answer is `Cache-Control: no-store`. A failure of one vector database out of several is logged as `[meaning-partial]`. /admin (Insights) has a panel per surface: searches, fell back, share, causes. The selftest shows the counts since the instance started and, with `?meaning=1`, runs a live check (one Voyage request: query size, every store answers). Evaluation rows now record `meaning` (used / fell back) and the run summary prints it.
Also fixed on the way: the selftest showed 0 ms for every stage (the time was read before the stage ran), and an error from Voyage's network was classed as a database error.

### Checks
`src/lib/acts/meaning.test.mjs`: causes, safe log detail, notice, cache rule, stats, and four class checks that fail if a file runs a meaning search without logging a fallback, if a search route can cache a fallback, if a screen shows meaning results without the notice, or if Ask drops the fallback (a mutation test confirmed the first one catches the regulator bug). The sweep opens Search Laws and Judgments in the fallback state at both widths and fails if the notice is not on the page.

### Production
Nothing was logged before today, so there is no count of past fallbacks in Vercel's logs or anywhere else. The count starts when this is deployed; /admin shows it.

## When meaning search falls back: a useful answer, and the real reason (Oct 30, 2026)

### Class 1: a keyword fallback that needs every word returns nothing for a sentence
**Cause.** Every keyword path used `websearch_to_tsquery`, which requires ALL the words. A sentence-style question ("what is the notice period after a cheque bounces") always has a word no section holds ("bounces"), so the fallback returned an empty list or a few odd sections, exactly when meaning search had just failed.
**Affected (4 of 4 keyword paths):** Search / Acts (`searchStore.ts`), Search / Regulators (`regSearch.ts`), Supreme Court text by words (`scText.ts`), and Ask's case-law passages, which had no fallback at all (Ask's section search uses the Acts path, so it is covered).
**Fix, once:** `src/lib/acts/looseQuery.mjs` (pure): drops filler words, adds the statutory synonyms of the question's words (`search-synonyms.json`), and says when to loosen (`looseTermsFor`: nothing or fewer than 5 results found, or a question of 4+ words). The loose search needs none of the words and ranks by how many a section holds (Acts: count of matching words squared, times the usual heading and Central boosts; regulators: the 200 candidates whose headings hold most words are ranked in full, because building the search vector of 100,000 instruments takes 15 s; judgments: at least two words, then the most words present). Quoted phrases and operators are never loosened. The result says so: "No result has all your words, so these match some of them, best matches first." Ask's own second keyword pass (`exact: true`) stays strict by design (a vague word match must not outrank the meaning results).
**Check:** `looseQuery.test.mjs` (word rules, no operator can get into the query, when to loosen) and a class test that fails if a keyword path has `websearch_to_tsquery` without `looseTermsFor`.
**Measured** (Voyage key deliberately wrong, so every search fell back; real data): "what is the notice period after a cheque bounces": before 0 results, after NI Act s.138 first of 11; "punishment for stealing a mobile phone": BNS s.317 in the first 3 (BNS 303, the theft section, is not); "can police arrest me without a warrant for a cheating complaint": BNSS s.35 second; regulators "foreign investment limits for a startup under FEMA": the RBI Master Circular on Foreign Investment first; Supreme Court "landlord evict tenant who sublets": 10 judgments where the strict word search found none. Not perfect: "security deposit" and "money lent" questions still return weak sections, because no section's wording matches.

### Class 2: a notice that says "busy" whatever the cause
**Cause.** The reason a call failed was thrown away at the catch and a fixed sentence was shown instead ("meaning search is busy", "Busy, try again in a minute", "the model is busy"), even when the key was missing or the limit was reached.
**Affected (9 places):** the Search notice on 3 screens (one shared function), Ask's section notice, Ask's case-law notice, the Vault note, the query-rewrite note in Ask and in Drafting, the Ask error, the three Drafting errors (generate, pick, retry a section).
**Fix, once:** three families, one place each. Search by meaning: `whyFor(cause)` in `meaning.mjs` (limit reached = Voyage 429; not set up / refused = no key, 401, 403; busy = timeout, 5xx, unreachable, store error), used by `noticeFor`, `askNoticeFor` and the new `docNoticeFor`. AI calls: `src/lib/ai/notice.mjs` (`aiFailure`, `aiReason`). The Ask stream's error `code` is now `limit`, `busy`, `not_set_up`, `blocked` or `failed`.
**Check:** tests for every cause on every surface; a class test that fails if any file under `src` contains "Busy, try again", "meaning search was busy" or "model is busy, so" (it found one I had missed: Drafting's own query-rewrite note). The UI sweep asserts the exact notice text for a rate-limit fallback on Search and Judgments.


## Icons and metadata images (Oct 31)

Class: an icon or share image that does not match the current logo, or that a browser cannot use. Found: the seven logo files in `public/brand` were still the old leaf; `/favicon.ico` was a redirect to the SVG (Safari shows no SVG tab icon, so it kept its old cached one); there was no `apple-touch` icon, web manifest or share image (their URLs returned the password page). The Vercel project icon is the production branch's tab icon (`main`, still the leaf) and changes only when `main` carries the new icon.
Fix, once: `scripts/reskin/make-icons.mjs` makes every icon (SVG, real `.ico` with 16/32/48, `apple-icon.png`, manifest icons incl. maskable, Open Graph and Twitter image, the `public/brand` logo files, `src/config/brand-meta.json`, `manifest.webmanifest`) from `src/styles/tokens.css` and `src/lib/brand.ts`. The layout lists no icons (Next reads the files); `PUBLIC_ASSETS` in `src/lib/access/token.mjs` keeps them outside the password. Check: `src/lib/brand-assets.test.mjs` (runs the generator with `--check`, forbids the old leaf and its colours, checks sizes, reachability and that no file lists icons of its own).
