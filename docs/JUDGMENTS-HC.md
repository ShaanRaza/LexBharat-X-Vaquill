# High Court case browse: implementation notes

Added 2026-10-20. High Courts now have the same drill-down as the Supreme Court: year grid, paginated case list, case detail page. Metadata only: no judgment text. Source: open-india-law `v2026.08` (CC BY 4.0), read from the local SSD at export time only.

## No person data for High Courts (2026-11-10, issue #1)
High Court pages, lists, search and the exported data carry **no party fields, no judges, no bench size and no advocates**. The parties appear only inside the case title, cleaned by the A225 rule, and only for courts listed in `HC_TITLE_COURTS` (below); every other High Court shows the case number only. The source fields hold personal data: of the Bombay cases, 34,944 petitioner fields hold age, occupation and home address, 12,243 party fields hold advocate names, and two judges share one string in at least 16,929 single-bench cases (LexBharat-from-scratch `reports/data-audit/REPORT.md`, J1 and J2). What changed:
- **Export** (`export-judgments-hc.sql`): petitioner, respondent, judges and bench size are not exported (they are read only to count what was removed, `_removed/<slug>.json`). The bench filter is gone. `title` is the case title **cleaned by the A225 rule** (`WP/933/2024 of A S/O X Vs B` becomes `A Vs B`), or none when it cannot be cleaned (below). The registration form is no longer the title: it is the case number. Output goes to a new folder, `../lexbharat-data/judgments-hc-v2`; the old `judgments-hc/` and `judgments-hc-gz/` are kept.
- **Case number:** `caseNumber` is the **registration form** read from the source title (`WP/933/2024 of A Vs B` gives `WP/933/2024`; `WRIT PETITION 609 of 1999` is kept whole; any other shape gives none). `caseNumberRecorded` is the dataset's own value. Their numbers disagree on 5,399,317 of 15,656,461 cases (34.5%; Allahabad 974,534 of 1,556,323, Patna 1,004,402 of 1,614,936), so both are kept, the page shows the recorded one when it differs, and **exact search matches either**.
- **Court:** still taken from the file; the case-id prefix matched the file's court on every one of the 15,656,526 records (0 quarantined for this reason). A row whose case-id prefix (CNR, for example `HCBM`) names another court is quarantined ("record id names another court"). The prefix map is `HC_PREFIXES` in `src/lib/judgments/hcRecord.mjs` (29 prefixes, 25 courts).
- **Site:** the page reader (`hcData.ts`) keeps only the allowed fields (`HC_FIELDS` in `hcRecord.mjs`), so even an older export that still holds parties cannot reach a page. Case rows and pages show parties, judges and bench for the Supreme Court only.
- **Search:** High Courts are searched by **case number or year only**. Party-name search is removed; a name query finds nothing.
- **AWS merge** (`scripts/w10/hc-merge-aws.mjs`): reads only cnr, title, decision date, disposal nature and date of registration (never the PDF flag, judge, advocate fields, description or raw HTML), cleans titles and reads case numbers the same way, and skips rows whose CNR prefix names another court.

### High Court case titles (2026-11-10, owner decision; LexBharat-from-scratch A224 to A226, PR #217)
- **Rule:** `src/lib/judgments/displayTitle.ts` is the TypeScript port of `core/display_title.py` (merge `543e4ff`). It removes the registration prefix, "None" and extra spaces, and cuts a father's or husband's name (S/o, W/o, D/o, C/o, "son of"), an age, an address (R/o, "resident of", "at post"), an occupation ("Occ.", ", JUNIOR CLERK,") and a dangling "REP. BY"/"THROUGH". It gives **no title** (null) when a judge, an advocate, a minor or guardian, a prisoner/police/employee number, a PIN or any 6+ digit run, mojibake, or no party at all is left, or the title is over 240 characters. The separator is kept as recorded (" Vs ", " v. ", "versus"). A null title means the page shows the case number.
- **One shared fixture:** `scripts/judgments/display-title-fixture.json`, 82 cases (69 High Court, 13 Supreme Court), each `{raw, court_type, expected, reason}`, read out of `tests/core/test_display_title.py`. The TypeScript tests (`src/lib/judgments/displayTitle.test.mjs`) and the Python original both pass every case. The same file is meant to sit next to `tests/core/test_display_title.py` in LexBharat-from-scratch and run there too (that change belongs to issue #213; not made from this branch). On a 50,000-title sample of all 25 courts, the Python and the TypeScript gave the **same output on every title** (98.94% shown; 426 no party, 75 minor, 24 number, 5 advocate).
- **Not ported exactly:** JS `\w`, `\d` and `\b` are ASCII-only (Python's are Unicode), so a title with non-Latin letters or digits could split differently; none did in the sample. The case-sensitive "MeherAge 72" rule is a separate regex (Python uses an inline `(?-i:...)` group). The Supreme Court branch is ported but not used (Supreme Court titles here are unchanged). The switch is this repo's own (below), not a port of `DISPLAY_TITLE_COURTS`: a bad value turns titles off instead of refusing to start.
- **Export:** DuckDB's regex engine has no look-ahead or look-behind, so the rule cannot run in SQL. The SQL passes the title (with "None" removed) as `titleRaw` into the temp files only; `scripts/judgments/hc-display-titles.mjs` writes `title` (or none), **removes `titleRaw` before any page is written**, and counts `title_shown`, `title_cleaned`, `title_dropped` and `title_dropped_reasons` in `_removed/<slug>.json`. A title that cannot be cleaned is null and counted; the guard is the hard fail behind it. Node imports the `.ts` file directly (Node 24 strips the types; it prints a one-line "module type" warning because `package.json` does not declare `"type": "module"`).
- **Switch:** `HC_TITLE_COURTS`. **Default empty: no High Court shows a title, only the case number.** `*` turns every High Court on; court slugs (`bombay-high-court,kerala-high-court`) turn those on. A value that names no High Court turns every court off and is logged at start. It is applied in one place, the page reader (`hcData.ts`): for a court that is not listed, `title` is removed before rows reach lists, search results, the case page or the API. For a listed court the heading is the cleaned title, with the case number below it.
- **Trial, not the full export** (Bombay and Sikkim into a scratch folder, 10 Nov): Bombay 1,559,583 of 1,578,864 titles shown, 19,106 (1.21%) none (13,033 no party, 3,787 minor or guardian, 1,565 number, 546 advocate, 171 judge, 3 mojibake, 1 empty); Sikkim 2,167 shown, 52 none. Guard passed on 3.08M rows; no `titleRaw` in any file.
- **Search** does not index titles: party-name search stays removed even for listed courts. Searching by the words in a title is a separate decision.
- **Not caught:** the rule cannot tell that a title names a child or a victim the court did not anonymise when the title carries no marker. Counsel review is tracked in LexBharat-from-scratch#218 and must happen before any High Court is listed.

### The guard, and what it does not promise
`scripts/judgments/check-hc-output.mjs` runs at the end of every export and of the AWS merge, and fails the run on any hit. It promises only two things:
1. **No person field** reaches the output: every row holds only `HC_FIELDS`, there is no `bench=` folder and no bench facet, and the search index has no word keys.
2. **Titles may name the parties, but carry no ages, occupations, addresses, PIN codes, relations, advocates or judges.** `title` may hold " Vs " and " v. " and must pass every A225 blocker (judge, advocate, minor or guardian, prisoner/police/employee number, PIN or 6+ digits, mojibake, a relation/age/address/occupation marker left over, a registration prefix or "None" left over, over 240 characters); a null title passes. `caseNumber` must be in registration form. Every other text field may hold none of: " Vs ", " v. ", "versus", S/o W/o D/o R/o C/o, "Age 45", "Occ.", "advocate", "Adv.", a 6-digit PIN code, a judge marker, a minor or guardian, a prisoner or police number ("C.NO.7006", "(C-11609)", "PC 1155"), or an address word ("resident of", "residing", "permanent address", "at post", "post:"). The raw title (`titleRaw`) never reaches the output. One exception, measured: "(J)" before the first slash of a case number is the case type ("Crl.A.(J)", a jail appeal; 1,386 cases in Gauhati, Tripura and Meghalaya), not a judge.

**It does not check the judgment body, and cannot.** It also cannot tell that a title names a child or a victim the court did not anonymise when the title carries no marker (LexBharat-from-scratch#218). The High Court export holds no judgment text. Wherever judgment text is used (Supreme Court opening text here; chunks, Qdrant payloads and embeddings in LexBharat-from-scratch) it is kept as recorded and **does contain the names of parties and judges, and sometimes addresses**. Pattern rules cannot find every name in free text. A hit is printed by file, field and kind only, never with the value. Tests: `node --test src/lib/judgments/hcRecord.test.mjs src/lib/judgments/displayTitle.test.mjs scripts/judgments/check-hc-output.test.mjs` (shared fixture `scripts/judgments/pii-guard-fixture.json`, all names invented; core/pii_guard.py in LexBharat-from-scratch, issue #213, uses the same fixture).

## Route scheme (stable)
| URL | What |
|---|---|
| `/workspace/browse/judgments/<court-slug>` | Year grid with counts; year cards are links when case lists are available |
| `/workspace/browse/judgments/<court-slug>?year=YYYY[&page=N]` | Paginated case list, newest first (20 per page); `page` restores the list page |
| `/workspace/browse/judgments/<court-slug>/<YYYY>/<caseId>?p=<file page>&lp=<list page>` | Case detail. `p` is the 100-case export page that holds the case (High Courts need it; the Supreme Court ignores it). `lp` only restores the list page on "back". An unknown or mismatched case returns a real 404. |
| `GET /api/judgments/courts` | Courts, counts, `listable`/`searchable` per court, stats, caveats, attribution |
| `GET /api/judgments/years?court=` | Case count per decision year |
| `GET /api/judgments/list?court=&year=&page=&pageSize=` | Paginated cases, newest first (1-100 per page). `available:false` only when no case source is configured. `disposition=` (a value from `facets.disposition`) filters the Supreme Court and every High Court. `bench=` answers 422 (the bench-size filter was removed). `search=` works for the Supreme Court only. The response carries `searchable`, `filterable` and `facets` (counts for the year). |
| `GET /api/judgments/case?court=&year=&id=&p=` | One case |

Court slugs are the 26 in `src/data/workspaceBrowse.ts`. A link without a correct `p` cannot find a High Court case (by design: no index of 15.6M ids); links produced by the list always carry it.

## Export shape (`scripts/judgments/export-judgments-hc.sh`)
```
../lexbharat-data/judgments-hc-v2/       (OUTSIDE the project; the older judgments-hc/ is kept, not used)
  court=<slug>/year=<YYYY>/page=<N>/data_0.json   JSON array, 100 cases per page, N from 1,
                                                   sorted by decisionDate DESC (undated last) then caseId
  court=<slug>/year=<YYYY>/disp=<label-slug>/page=<N>/data_0.json   the same cases filtered by disposition chip; each row adds mainPage
  court=<slug>/year=<YYYY>/facets.json   {disposition:[{value,slug,count}]}
  _manifest/<slug>.json                  [{year, cases, pages}]
  _quarantine/<slug>.json                cases left out, with reason and raw values
  _fields/<slug>.json                    fill rates (source of the table below)
  _removed/<slug>.json                   counts of what was left out (parties, judges, titles shown / cleaned / dropped by reason, titles with no case number, case-number disagreements, wrong-court ids)
```
Case fields (`HC_FIELDS`, nothing else): `caseId, title (cleaned by the A225 rule; served only for courts in HC_TITLE_COURTS), caseNumber (the registration form read from the title), caseNumberRecorded (as recorded), decisionDate (YYYY-MM-DD), disposition (as recorded), dispositionLabel (chip text), citation, dateOfRegistration (as recorded), pages`, plus `mainPage` on filtered lists. Null fields are omitted. The SQL is in `scripts/judgments/export-judgments-hc.sql`. `scripts/judgments/split_pages.py` (stdlib Python) writes the page files from a DuckDB NDJSON stream.

A full run also rewrites `src/data/judgments/court-years.json` and `courts.meta.json` so counts equal the page files exactly (Supreme Court rows are kept). Filtered runs (`HC_COURTS`, `HC_YEARS`) do not touch them.

## Normalization and exclusions
- **Court names:** the court comes from the source file (25 canonical slugs and display names), never from the free-text `court` column, which has 50 spellings across the files (for example Bombay: "Bombay High Court", "High Court of Bombay", "High Court of Mumbai", blank). Browse results are never split by spelling. A row whose case-id prefix names another court is quarantined.
- **Year:** the year of `decision_date` when it parses and lies in 1900-01-01..2026-08-31; if the date is blank, the record's `year` when 1900-2026 (the case then shows "No decision date recorded"); otherwise the case is quarantined.
- **Quarantine:** 65 High Court cases (for example Kerala `KLHC010748912008`, date 2088-11-28; 47 unparseable dates and 18 out-of-range dates across many courts). They appear in no list; counts: valid 15,693,475 + quarantined 65 = 15,693,540.
- **Titles and case numbers:** the source writes a missing number as the word "None" ("WRIT PETITION None", "None None"); it is stripped. The case number is the registration form: `TYPE/NUM/YEAR` ("WP(C)/19571/2019 of ... Vs ..." gives "WP(C)/19571/2019"; "/151/2022 of ..." with no type gives "151/2022"), or the whole title when it is only `TYPE NUM of YEAR` / `TYPE NUM/YEAR`; any other shape gives none (39,322 cases, 0.25%, in the export of 2026-11-10). The title is cleaned by the A225 rule (above).
- **Judges and bench size (High Courts):** not exported, not shown (see "No person data" above).
- **Supreme Court judges** are shown as the **authoring judge** (the dataset lists the judge who wrote the report, 100% name-like, not the full bench). The full bench is a separate extracted field, below. The dataset's own bench strength is not used for the Supreme Court: it would read "single judge" for 87% of cases.
- **Party names (High Courts):** not exported, not shown, not searched.
- **Disposition chip:** the source has 498 spellings. A chip is shown only for the 20 common, unambiguous values (Allowed, Dismissed, Disposed of, Rejected, Bail granted/rejected, Closed, Withdrawn, Partly allowed, Quashed, Remanded, Acquitted, Convicted, Granted, Dismissed as infructuous/withdrawn/on merits), about 92% of cases. Everything else appears only as recorded text on the detail page.
- **Pages:** the last page the extracted text reaches (max `page_end` over a case's chunks). Every case has it, and it never decreases along the text in 99.1% (Bombay) and 99.7% (Delhi) of cases checked; values above 2000 are dropped. It is the length of the extracted text, not an official page count.
- **Citation:** blank for every High Court (0%). The detail page says "No reporter citation is available for this record" and the case number is the main identifier.

## Field fill rates by court (share of exported cases showing the field; export of 2026-11-10, before the AWS additions)
| Court | Cases | Title | Case no. (title) | Case no. (recorded) | Date | Disposition | Disposition chip | Pages |
|---|---|---|---|---|---|---|---|---|
| allahabad-high-court | 1,556,323 | 99.9% | 99.9% | 63.3% | 100.0% | 99.4% | 87.2% | 100.0% |
| andhra-pradesh-high-court | 261,773 | 99.7% | 99.7% | 98.6% | 99.4% | 99.5% | 88.4% | 100.0% |
| bombay-high-court | 1,578,864 | 99.7% | 99.7% | 99.0% | 99.5% | 99.3% | 94.5% | 100.0% |
| calcutta-high-court | 340,418 | 97.7% | 97.7% | 43.2% | 99.2% | 98.9% | 98.6% | 100.0% |
| chhattisgarh-high-court | 509,786 | 99.9% | 99.9% | 85.8% | 99.9% | 99.9% | 99.2% | 100.0% |
| delhi-high-court | 330,400 | 98.6% | 98.6% | 70.9% | 99.9% | 85.0% | 84.9% | 100.0% |
| gauhati-high-court | 286,466 | 99.2% | 99.2% | 75.3% | 99.6% | 94.3% | 93.8% | 100.0% |
| gujarat-high-court | 405,840 | 99.9% | 99.9% | 99.6% | 100.0% | 99.8% | 87.6% | 100.0% |
| high-court-of-jammu-and-kashmir-and-ladakh | 100,285 | 99.3% | 99.3% | 97.0% | 99.9% | 98.4% | 86.1% | 100.0% |
| himachal-pradesh-high-court | 254,825 | 97.4% | 97.4% | 98.9% | 99.2% | 98.8% | 97.0% | 100.0% |
| jharkhand-high-court | 420,729 | 99.9% | 99.9% | 99.8% | 99.7% | 99.7% | 76.1% | 100.0% |
| karnataka-high-court | 686,152 | 99.9% | 99.9% | 97.2% | 99.8% | 99.8% | 98.3% | 100.0% |
| kerala-high-court | 1,018,714 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 99.2% | 100.0% |
| madhya-pradesh-high-court | 646,344 | 100.0% | 100.0% | 87.2% | 100.0% | 100.0% | 99.6% | 100.0% |
| madras-high-court | 1,498,010 | 99.9% | 99.9% | 98.5% | 100.0% | 99.6% | 85.6% | 100.0% |
| manipur-high-court | 16,763 | 99.9% | 99.9% | 99.6% | 99.7% | 99.6% | 96.9% | 100.0% |
| meghalaya-high-court | 10,827 | 100.0% | 100.0% | 98.9% | 100.0% | 100.0% | 99.6% | 100.0% |
| orissa-high-court | 685,646 | 99.5% | 99.5% | 99.8% | 99.9% | 99.5% | 99.1% | 100.0% |
| patna-high-court | 1,614,936 | 99.8% | 99.8% | 100.0% | 99.6% | 98.3% | 97.4% | 100.0% |
| punjab-and-haryana-high-court | 1,133,710 | 99.8% | 99.8% | 52.4% | 99.8% | 99.9% | 99.8% | 100.0% |
| rajasthan-high-court | 1,056,767 | 100.0% | 100.0% | 95.6% | 100.0% | 99.7% | 98.9% | 100.0% |
| sikkim-high-court | 2,219 | 99.6% | 99.6% | 90.9% | 99.6% | 99.8% | 99.6% | 100.0% |
| telangana-high-court | 1,005,127 | 99.9% | 99.9% | 96.1% | 99.9% | 99.8% | 88.5% | 100.0% |
| tripura-high-court | 30,062 | 98.6% | 98.6% | 83.3% | 99.7% | 99.6% | 99.3% | 100.0% |
| uttarakhand-high-court | 205,475 | 99.5% | 99.5% | 91.2% | 99.9% | 99.5% | 99.3% | 100.0% |

The recorded case number is the weakest field (Calcutta 43%, Punjab and Haryana 52%, Allahabad 63%, Delhi 71%); the number read from the title fills most of those gaps. Delhi disposition is 85%. Parties and judges are not exported. Rajasthan has far more `case_id` values (1,056,767) than distinct case numbers (about 308,000), so its counts are records, not cases.

## Where the case pages are read from
`src/lib/judgments/hcData.ts`: `JUDGMENTS_DATA_DIR` (local folder, development) or `JUDGMENTS_DATA_URL` (https base serving the same layout). With neither set, High Courts are honestly count-only: `listable:false`, cards say "(counts by year only)", year cards are inert, copy says case lists are not available. The Supreme Court is bundled (`src/data/judgments/sc/*.json`, 12 MB) and always works.

## Commands (SSD attached)
```bash
scripts/judgments/export-judgments-hc.sh                      # full High Court export, about 3 minutes, needs the DuckDB CLI
HC_COURTS=delhi-high-court HC_YEARS=2024-2025 scripts/judgments/export-judgments-hc.sh   # a subset (does not refresh counts)
scripts/judgments/export-judgments.sh                         # Supreme Court case files (unchanged)
scripts/judgments/export-sc-preview.sh /Volumes/LAWSSD/open-india-law ../lexbharat-data/judgments-hc-v2   # Supreme Court opening text into the same folder (script unchanged)
echo "JUDGMENTS_DATA_DIR=../lexbharat-data/judgments-hc-v2" > .env.local   # local dev and local production build
npm run build && npm start
```

## Production (Cloudflare R2, or any static host)
The folder is too big for the repo or a Vercel function, so production reads it from a bucket: set `JUDGMENTS_DATA_URL` to the bucket's public base URL (no code change, no dependency). Without it production High Courts stay honestly count-only.
```bash
scripts/judgments/export-judgments-hc.sh          # about 6 minutes, SSD attached
scripts/judgments/export-sc-preview.sh /Volumes/LAWSSD/open-india-law ../lexbharat-data/judgments-hc-v2   # Supreme Court opening text lives in the same folder
node scripts/judgments/build-hc-search-index.mjs   # case-number index into judgments-hc-v2/search
node scripts/judgments/check-hc-output.mjs         # the guard, over everything just built
scripts/judgments/gzip-for-upload.sh              # ../lexbharat-data/judgments-hc-v2-gz
rclone copy ../lexbharat-data/judgments-hc-v2-gz r2:lexbharat-judgments --header-upload "Content-Encoding: gzip" --header-upload "Content-Type: application/json" --transfers 32 --checkers 32 --progress
```
Uploading the uncompressed folder also works but is 11.7 GB (over R2's 10 GB free tier). The gzip upload relies on the objects being served with `Content-Encoding: gzip`, which `fetch()` decompresses transparently.

## Deferred, with the reason
| Item | Why it is not in this build |
|---|---|
| **Short text snippet** | No clean source. The `description` field is the first ~300 characters of the raw document (letterhead such as "IN THE HIGH COURT OF JUDICATURE AT BOMBAY BENCH AT NAGPUR", file names like "6391-2012.odt", "Page 1 of 4 $~24"); the first text chunk starts with the same boilerplate. A real preview needs a verified rule for finding the operative text of each court's judgments. |
| **Search by party name (High Courts)** | Removed on purpose (personal data). Not deferred. |
| **Search by party name inside a High Court year (historical note)** | A year can hold up to 158,000 cases in up to 1,600 files read 100 at a time. Name search needs an index (a database or search service), which is the hosting decision still open. Filters were possible without one because they are shaped at export time: each filter value has its own pre-built list. |
| **Supreme Court bench-size filter** | The source's bench field understates real benches (see above). |
| A way to find a High Court case from its id alone; judgment text; reporter citations for High Courts | No index; text not exported; the source has none. |

Filters are live: the Supreme Court (disposition, values from the year's data) and every High Court (disposition chips). The High Court bench-size filter was removed. Filter counts are exact because they are counted at export time.

## Lawyer-facing additions (case detail, Supreme Court search and opening text)
**Keep the export folders outside the project.** With 328,000 to 656,000 files inside the project folder, `next build` ran out of memory (4 GB heap, 7+ minutes); outside it builds in about 15 seconds. All scripts now default to `../lexbharat-data/`.

### Case detail (`/workspace/browse/judgments/<court>/<year>/<caseId>`, all courts)
Supreme Court: heading is the parties line (petitioner v. respondent) when both passed the sanity check, otherwise the title. High Courts: heading is the title in registration form, or the case number; no parties, judges or bench. Then court, citation (Supreme Court: monospace, copyable) or case number with the note "None in this dataset for High Courts. Cite by case number." (and the recorded number when it differs from the title), decision date, disposition, Supreme Court authoring judge and bench, pages, record ID, and a Copy button (Supreme Court: the citation; High Courts: "Case no. X, Court (decided date)", never an invented citation). Supreme Court list rows show the citation next to the date with the same copy button.
The page ends with **Where each field comes from**: every field marked as recorded, imperfect or absent, with the reason (`src/lib/judgments/provenance.ts`).

### Supreme Court opening text (`export-sc-preview.sh`)
Finding: one SC `case_id` holds several parallel documents (English plus Hindi, Punjabi, Gujarati and others; `language_code` tells them apart) and `chunk_index` repeats across them: only 602 of 37,014 cases have a clean 0..n-1 sequence, and offsets increase in only 70% of consecutive chunk pairs. So chunks cannot be ordered or joined, and "first chunk" is ambiguous.
A safe document start exists for most cases: the single chunk with `language_code = 'en'` AND `char_start = 0` (exactly one in 35,592 cases; none in 1,422). Its first ~900 characters, minus the "Case:/Section:" header lines and `[TITLE]` markers, are the preview; it must be at least 200 characters and at least 85% of its words must look like words (OCR noise fails). Result: **32,946 of 37,014 cases (89.0%)** have a preview; the rest show "No clean English opening text". Previews are mostly the SCR headnote (parties, date, bench, subject, holding), with occasional OCR slips such as "BHARAT!", so the page labels them "as extracted". Hosted per year: `court=supreme-court-of-india/year=YYYY/preview.json` (`{caseId: text}`), next to the High Court pages, so production needs the upload.
**High Courts: no preview.** About 1 KB for each of 15.7 million cases would be roughly 15 GB, and the first lines are court letterhead, not holdings.

### Cross-year Supreme Court search (`GET /api/judgments/search?q=`)
A pre-built static index (`scripts/judgments/build-sc-index.py`, 5.5 MB, bundled; needs no SSD and no new dependency) matches words at the start of words in the case title (which carries both parties) and in the citation: "kesavananda", "state of punjab", "Sharma v Devi Lal", "[1985] 2 S.C.R. 224" all work, in a few milliseconds. Results whose title or citation contains the whole phrase come first; each group is newest first. The browse page shows these results above the court list.
**Not built, and why:** search by topic or holding (needs full text, which cannot be ordered safely) and High Court name search (15.7 million records, no index). Options for a later decision: Postgres full-text search (needs a hosted Postgres and a driver), or a search service (Typesense, Meilisearch, OpenSearch). Both are new infrastructure.

### Acts referred to: not shown
Judgments carry no act-reference field. The legislation files' `acts_referenced` links acts to acts. Linking a judgment to the acts it interprets would mean guessing from text we cannot order, so no chips are shown; the provenance panel says so.

## Fields extracted from Supreme Court report text (`export-sc-fields.sh`)
Rules live in one shared, dependency-free file, `src/lib/judgments/extract.mjs` (pure string parsing: no network, no packages). `scripts/judgments/extract-sc-fields.mjs` runs it over **every** Supreme Court case with an English opening (35,592 of 37,014) and merges the results into the bundled `src/data/judgments/sc/<year>.json`, so they work in production without the R2 upload. Unit tests: `npm run test:extract` (`node --test`, 12 groups: the four named cases, 10 random cases drawn with a fixed seed and 10 CJI / single-J headings, all checked by eye, bench shapes, OCR repairs, negatives, vocabulary, case-number variants, the guard).
Both fields are shown as "from the judgment text" (◐) and are left **absent** when the text is not clean; the app then keeps the dataset's authoring judge and the "not found" note.

| Field | Source text | Rule | Coverage |
|---|---|---|---|
| **Bench (from judgment text)** (`benchExtracted`) | the first bracketed block ending in J./JJ./CJ./CJI: `[A and B, JJ.]`, `(A, B and C, JJ.)`, `[A, CJI and B, JJ.]` | Split on commas, "and", "&"; titles (J., JJ., CJ., CJI) dropped. Each name must look like a person's name (capitals or title case, never mixed; no glued AND such as "ANDHRISHIKESH"; no title words) and must be in the dataset's own judge list or be the dominant spelling across reports (10+ benches, and not a near variant of a spelling 5x as common). OCR repairs, each confirmed by that check: a stray dot (PALEK.AR), K read as "IC", an initial J whose full stop became a comma ("C.J., J, C. SHAH" is J.C. SHAH), a stray quote or AND glued to an initial, the closing bracket read as j, and a name one or two letters off exactly one known name of 10+ letters (LAUT/LALIT). Names print in the dataset's spelling ("H.R. KHANNA"). The dataset's authoring field must agree: at least one of its names must be on the bench, compared by initials and surname, case and dots ignored (the dataset writes BHUSHAN RAMKRISHNA GAVAI where the report prints B.R. Gavai). A heading ending in a single "J." is accepted like "JJ." ("[B.R. Gavai, CJI and Augustine George Masih,* J.]", "[C.K. THAKKER, J.]"). Any failure leaves the field absent: never a partial bench. | **24,229 of 37,014 cases (65.5%)**; by decade of decision: 1950s 9%, 1960s 25%, 1970s 35%, 1980s 44%, 1990s 77%, 2000s 70%, 2010s 79%, 2020s 86%. The rest have no bracketed bench in the opening text (running headers, scans) or an OCR-damaged name. |
| **Case number** (`caseNumberExtracted`) | `(Criminal Appeal No. 512 of 2020)`, `(Crl. Appeal Nos. 1234-1235 of 2016)`, `(Civil Appeal No(s). 7 of 2019)`, `(Writ Petition (Civil) No. 3 of 2020)`, SLP, Special Leave / Transfer / Review / Contempt / Curative / Arbitration / Election Petition, Transferred Case | Only the bracketed form, only these types, 1-6 digits (a range or list is allowed; several numbers in one heading are kept together as one string), a four-digit year not after the year of the report. Anything else in the bracket (such as "of this Court was heard") means no value. | **11,831 cases (32.0%)**: 0% before 2000 (those reports never print the number), 11% in the 2000s, **86% in the 2010s, 95% in the 2020s**. |
| **Disposition label** | the dataset's `disposition` | `src/lib/judgments/disposition.ts`: equivalent spellings share one label ("Appeal(s) allowed" and "Case Allowed" become "Allowed"; "Disposed off" becomes "Disposed of"; ...); the recorded value stays visible. High Court chips use the same words. | all dispositions |

**"ALL cases" means the rules run on every case, not that every case yields a value.** A bench or number is shown only when it parses cleanly, which is why older, OCR-damaged reports mostly stay on the dataset's single authoring judge.
**Bad-match guard:** a match that covers more than 5% of the text is logged with `console.warn` and ignored. The allowance grows with the number of names (40 characters each), because the genuine 13-judge Kesavananda bench is already 5.1% of its opening chunk; without that it would be discarded.
Regenerate with the SSD attached: `scripts/judgments/export-sc-fields.sh` (also the last step of `export-judgments.sh`); commit the rewritten year files.

## High Court search by case number (`build-hc-search-index.mjs`)
**Changed 2026-11-10 (issue #1):** the index holds only case-number keys (`#933/2024`, from the title and the recorded number) and year keys (`@2024`); no words, so party names are not searchable. The guard fails on any word key. The text below describes the earlier party-name index and is kept for its measurements.

**What it is:** `GET /api/judgments/search-hc?q=&court=&year=&page=&pageSize=` finds High Court cases across all years (and all courts, or one court, or one court-year) by **party names and case numbers as recorded in the dataset**, newest first. It is not a search of judgment text, and the pages say so. A pure case number ("933/2024", "933 of 2024", "WP/933/2024") returns exactly the cases carrying that number (15 courts for 1725/2024, for instance); words are matched as whole words, and a typed word that matches nothing exactly falls back to words that start with it. The Supreme Court keeps its own endpoint (`/api/judgments/search`, unchanged).
**How:** a static inverted index built from the exported case pages, nothing else: `npm run index:hc-search` (about 2 minutes, reads `../lexbharat-data/judgments-hc-v2`, writes `search/` beside it). Document ids run newest year first, then court, then position in the list, so the smallest ids are the newest cases and an id maps to (court, year, page, row) with a binary search over `meta.json`. 512 shard files hold `word -> delta-encoded ids`; a query reads only the shards of its words. Words come from the petitioner and respondent (or the title when parties were not extracted), without case-type words and stop words; case numbers are read from the recorded number and from references in the title, and a type code with digits ("A482/42016/2023") yields 42016/2023, not fragments. Shared code: `src/lib/judgments/hcSearchCore.mjs` (tested: `npm run test:extract`).
**Size, measured:** 15,656,461 cases, 141.6 million postings, 3.46 million distinct words: **565 MB of shards, 224 MB gzipped** (largest shard 21 MB raw, 3.5 MB gzipped; `meta.json` 24 KB). Year keys (below) added 9 MB gzipped. **This is far above the 15 MB target, and a full-coverage index cannot be that small:** every case contributes about 8 words, and names are high-entropy. Splitting per court does not help (Bombay alone is about 26 MB gzipped), and nothing near this size can be bundled with the app or the repo. So the index lives next to the case pages and is read the same way (`JUDGMENTS_DATA_DIR` locally, `JUDGMENTS_DATA_URL` in production, included by `gzip-for-upload.sh`). A query costs 8 to 200 ms locally once its shards are loaded.
**Without the index:** `indexAvailable: false` with HTTP 200 (never an error page); the court-year pages then say name search is not available, and the browse page says so under "High Court cases". **Production therefore has no High Court search until the data folder is hosted** (the same step that turns on High Court case lists).
**Not covered:** case type ("bail", "writ" are not indexed), words inside a word, judgment text, and spelling variants of a name. Names that the source garbled or did not extract cleanly are found only through the words that survived (for example "Learned counsel for the applicant ..." appears as a party in some Allahabad records). Results are year-major, then court, then date within the court-year, so "newest" is exact within a court and by year across courts.

### Years in queries, and the same search everywhere (fix, 2026-10-22)
- **Bug:** "2024" on the Bombay 2025 page returned "0 cases match". Not the year filter (the 2025 page does list cases numbered x/2024: 1,762 of a sample of 8,000 Bombay 2025 cases, and `933/2024` on that page returns them) and not a missing index (names on the same page worked): the tokenizer keeps alphabetic words only, so "2024" produced no word and no case-number key, and the planner returned early. **Fix:** every case number's year is indexed as a year key (`@2024`), and a bare four-digit year (1900-2039) in a query becomes that key, alone or combined with words ("kumar 2024"). Other bare numbers ("933") are still not indexed: they would add an unbounded vocabulary; type the year too ("933/2024").
- The dataset's `caseId` (for example HCBM030198422024) is an identifier, not the case number; the case number is a separate field ("933 of 2024", "2984/2010", sometimes only "933", sometimes missing). Its year is read from the recorded number and from references in the title, never from the `caseId`: the digits at the end of a `caseId` do not match the case-number year (HCBM030523912023 is case 3969 of 2024).
- **Supreme Court pages now behave like High Court pages:** the year list has the same "this year / all years" toggle (all years uses the cross-year index), and each court's own page (year grid) has the same bar for all years. Supreme Court search now also matches the case number read from the judgment heading ("5491/2024"), uses the same word matching for the year list and the cross-year search, and folds accents. A bad `court` parameter on a search or list endpoint answers 422.
- Smoke test: `node --experimental-websocket scripts/judgments/qa-search-smoke.mjs` (API checks plus headless-Chrome page checks; report in `scripts/judgments/qa-search-report.md`).
