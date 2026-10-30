# End-user QA: Acts and Judgments (2026-10-20, local build with Phases 2 and 3)

> Figures in this file are as of 2026-10-20 (the original export). The current figures are in `docs/DATA-GAPS.md`.

Method: every check compares what the API or page returns with an independent recomputation from `/Volumes/LAWSSD/open-india-law` (DuckDB), not with the exported JSON the app reads.

## Passed
| Check | Result |
|---|---|
| All 21,352 acts returned by `/api/acts/list` (214 pages) vs parquet: title, year, status, category, state, department, section count | 0 mismatches (after the year fix below) |
| Search: 8 terms (contract, bharatiya nyaya, evidence act, Reserve Bank, GST, tax, "(Rep.") counts vs brute-force title match | all equal |
| 14 filter combinations (category, status, state, department, year range, search) counts vs ground truth | all equal |
| Pagination: Kerala acts walked in 4 sort orders | 322 unique, none missing, none repeated |
| Sort year asc/desc, page beyond range, 10 invalid parameters | correct, invalid inputs return 422 |
| Court totals, all 26 courts, vs distinct case_id in each parquet file | 0 mismatches (15,693,540) |
| Per-year counts: Delhi, Kerala, Supreme Court, every year | exact match |
| Supreme Court lists 1950, 1990, 2025: id sets and title/citation/disposition/date | identical |
| UI: filters, empty state, Supreme Court list paging and search, unknown court (404), bad `year` param | work |

## Broken, now fixed
1. **Wrong years on regulators (87 entries).** The export took a year from the title, so "Government Stock, 2082" became year 2082 and sorted first under "Newest first", and "Act IX of 1872" became 1872. Fix: no title-derived years for regulators (`scripts/acts/export-regulations.sql`); max year is now 2026. Legislation's 20 title-derived years were checked by hand and kept.
2. **Raw error text.** A non-JSON failure (for example a 502 page) showed "Failed to execute 'json'..." to users. Now a plain message with a "Try again" button (acts list and Supreme Court case list).
3. **Misleading search box.** It said "Search cases, acts, or legislation across all courts" but on the Judgments tab it only filtered court names ("Kesavananda" gave "No courts match"). Placeholder and help text are now per tab and say what the box does.
4. **No state or regulator filter in the UI** although the API supports them (8,544 state acts, 11,240 regulator entries). Added State/UT and Regulator selects (shown only when relevant).
5. **Raw slugs as labels** (`west-bengal`, `sebi`, `in_force`). Display labels added; query values are unchanged.

## Not fixed (deferred, by design or scope)
- **No detail pages** for acts or cases: result cards are not clickable. Section text and judgment text are not available (chunk order not validated; see `docs/CHUNK-ORDER-VALIDATION.md`).
- **No search across years** for judgments (search works inside one Supreme Court year). High Court case lists do not exist.
- **Regulator data quality is the source's:** many titles are circulars or junk ("Advisory022026", "Regulation 02082024"); 2,484 acts have no year; 12% of acts show section count unavailable.
- **Production is behind local.** `origin/main` is still the Phase 1 commit, so production has no regulators, no judgments pages and none of these fixes until these commits are pushed.
- Page titles still say "(local mock)" because of the console release toggle; unchanged here.
- Not tested: other browsers, phones, screen readers, load.

## Update: High Court case-level browse (same day, after the High Court QA)
Resolved locally (see `docs/JUDGMENTS-HC.md`):
- High Court year cards are links; `?year=` opens that year's list; `/api/judgments/list` returns real paginated High Court cases.
- Every list row opens a case detail page (Supreme Court and High Courts share one route scheme); unknown cases give a real 404.
- Landing copy, cards and caveats now follow what the court can actually do ("counts by year only" when no case source is configured).
- Court-name spellings no longer matter (court comes from the file); 65 impossible/unparseable-year cases are quarantined and listed in `_quarantine`, not mixed into lists.
- Local smoke tests passed for Bombay 2025, Delhi 2025, Kerala 2024 and Supreme Court 1990: page loads, year link, non-zero list equal to the year count, paging (including the 100-case file boundary and the last partial page), case detail, real 404, and the no-data-source fallback.

Remaining caveats: production High Courts stay count-only until the exported folder is hosted and `JUDGMENTS_DATA_URL` is set; High Court judges are not shown (source field is corrupt); no search inside a High Court year; High Court links need the `p` page number; case number is missing for 17-57% of cases in some courts (Calcutta, Punjab and Haryana, Allahabad, Delhi).

## Update: Round 1 upgrade (richer rows, rebrand, filters)
Done (details in `docs/JUDGMENTS-HC.md`): newest-first lists; parties line; disposition chips; judges and bench size only for Bombay, Gujarat and Orissa (verified cases only); page count; case-reference headline; "No decision date recorded" instead of blanks; Supreme Court in-year disposition filter with counts. Workspace shell is LexBharat-branded (logo, India selector, no mock banner, no "Not in clone" items, titles without "(local mock)"); the simulated notice now sits only on the developer console, reworded without the Vaquill name.

Deferred on purpose: text snippets (no clean source), High Court filters and search (need an index), Supreme Court bench filter (source understates benches). Not changed: the developer console Playground still shows code samples with the host `https://api.vaquill.ai` and `VAQUILL_API_KEY`; they point at another company's API and should be replaced when LexBharat has its own API host.

## Update: High Court filters
In-year disposition filters now work for every High Court (counts exact, from export-time facets) and a bench-size filter for Bombay, Gujarat and Orissa; one filter at a time. Tested locally: Bombay 2025, Delhi 2025, Kerala 2024 (facet totals equal list totals, filtered lists walked page by page with no gaps or repeats, filtered rows open the right case detail, newest first). Still deferred: party-name search for High Courts (needs an index), combined filters. Fixed: a case title that was exactly "None" showed as "None" in the list.

## Update: lawyer workflow additions
Shipped: richer case detail for all courts with a provenance panel; copyable citation on Supreme Court rows and pages; Supreme Court opening-text preview (89.0% of cases); cross-year Supreme Court search by party or citation. Not shipped: act chips on judgments (no field in the dataset), High Court previews (size, letterhead), topic search and High Court name search (need an index). Details: `docs/JUDGMENTS-HC.md`.

## Update: extracted bench and case number, unified dispositions
Supreme Court cases now show the full bench (47.8% of cases) and the case number (30.3%) extracted from the report heading, labelled "extracted" and left absent when the text is not clean; the dataset's judge stays as "authoring judge". Supreme Court dispositions share one vocabulary with the High Courts, with the recorded value kept visible. Rules and coverage: `docs/JUDGMENTS-HC.md`.

## Update: extraction run on all Supreme Court cases
Bench 59.5% and case number 32.0% of all cases (case number 86-95% since 2010); shared tested util `src/lib/judgments/extract.mjs`, `npm run test:extract`; bench names shown as badges labelled "Bench (from judgment text)". See `docs/JUDGMENTS-HC.md`.

## Update: CJI / single-J headings and initials-based authoring check
Bench now found for 24,229 of 37,014 Supreme Court cases (65.5%): headings such as "[B.R. Gavai, CJI and Augustine George Masih,* J.]" (2025_INSC_1288) work, and the dataset's authoring field is compared by initials and surname, any one name sufficing. Tests: `npm run test:extract` (12 groups).
