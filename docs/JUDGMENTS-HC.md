# High Court case browse: implementation notes

Added 2026-10-20. High Courts now have the same drill-down as the Supreme Court: year grid, paginated case list, case detail page. Metadata only: no judgment text. Source: open-india-law `v2026.08` (CC BY 4.0), read from the local SSD at export time only.

## Route scheme (stable)
| URL | What |
|---|---|
| `/workspace/browse/judgments/<court-slug>` | Year grid with counts; year cards are links when case lists are available |
| `/workspace/browse/judgments/<court-slug>?year=YYYY[&page=N]` | Paginated case list, newest first (20 per page); `page` restores the list page |
| `/workspace/browse/judgments/<court-slug>/<YYYY>/<caseId>?p=<file page>&lp=<list page>` | Case detail. `p` is the 100-case export page that holds the case (High Courts need it; the Supreme Court ignores it). `lp` only restores the list page on "back". An unknown or mismatched case returns a real 404. |
| `GET /api/judgments/courts` | Courts, counts, `listable`/`searchable` per court, stats, caveats, attribution |
| `GET /api/judgments/years?court=` | Case count per decision year |
| `GET /api/judgments/list?court=&year=&page=&pageSize=` | Paginated cases, newest first (1-100 per page). `available:false` only when no case source is configured. `disposition=` (a value from `facets.disposition`) filters the Supreme Court and every High Court; `bench=single|division|larger` filters Bombay, Gujarat and Orissa; only one filter at a time (422 otherwise). `search=` works for the Supreme Court only. The response carries `searchable`, `filterable` and `facets` (counts for the year). |
| `GET /api/judgments/case?court=&year=&id=&p=` | One case |

Court slugs are the 26 in `src/data/workspaceBrowse.ts`. A link without a correct `p` cannot find a High Court case (by design: no index of 15.6M ids); links produced by the list always carry it.

## Export shape (`scripts/judgments/export-judgments-hc.sh`)
```
data/judgments-hc/                       (gitignored; 327,974 files, 11.7 GB of JSON for the full snapshot, about 2.3 GB gzipped)
  court=<slug>/year=<YYYY>/page=<N>/data_0.json   JSON array, 100 cases per page, N from 1,
                                                   sorted by decisionDate DESC (undated last) then caseId
  court=<slug>/year=<YYYY>/disp=<label-slug>/page=<N>/data_0.json   the same cases filtered by disposition chip; each row adds mainPage
  court=<slug>/year=<YYYY>/bench=<single|division|larger>/page=<N>/data_0.json   filtered by bench class (Bombay, Gujarat, Orissa only)
  court=<slug>/year=<YYYY>/facets.json   {disposition:[{value,slug,count}], bench:[{value,count}]}
  _manifest/<slug>.json                  [{year, cases, pages}]
  _quarantine/<slug>.json                cases left out, with reason and raw values
  _fields/<slug>.json                    fill rates (source of the table below)
```
Case fields: `caseId, title, caseNumber, decisionDate (YYYY-MM-DD), disposition (as recorded), dispositionLabel (chip text), petitioner, respondent, citation, dateOfRegistration (as recorded), pages, judges + benchSize (three courts only)`. Null fields are omitted. The SQL is in `scripts/judgments/export-judgments-hc.sql`. `scripts/judgments/split_pages.py` (stdlib Python) writes the page files from a DuckDB NDJSON stream.

A full run also rewrites `src/data/judgments/court-years.json` and `courts.meta.json` so counts equal the page files exactly (Supreme Court rows are kept). Filtered runs (`HC_COURTS`, `HC_YEARS`) do not touch them.

## Normalization and exclusions
- **Court names:** the court comes from the source file (25 canonical slugs and display names), never from the free-text `court` column, which has 50 spellings across the files (for example Bombay: "Bombay High Court", "High Court of Bombay", "High Court of Mumbai", blank). Browse results are never split by spelling.
- **Year:** the year of `decision_date` when it parses and lies in 1900-01-01..2026-08-31; if the date is blank, the record's `year` when 1900-2026 (the case then shows "No decision date recorded"); otherwise the case is quarantined.
- **Quarantine:** 65 High Court cases (for example Kerala `KLHC010748912008`, date 2088-11-28; 47 unparseable dates and 18 out-of-range dates across many courts). They appear in no list; counts: valid 15,693,475 + quarantined 65 = 15,693,540.
- **Titles:** the source writes a missing number as the word "None" ("WRIT PETITION None", "None None"); a trailing "None" is stripped and an empty result becomes no title (the UI then shows "Case <number>" or the record id). Titles are otherwise as extracted.
- **Judges and bench size** are exported only for Bombay, Gujarat and Orissa, and only for a case whose every judge entry looks like a person's name (capital letters, dots, apostrophes, hyphens; no "CORAM", no names glued to "ORAL"). A case with any other entry gets no judges and no bench size, never a partial list. Why: in the other 22 courts the field is mostly sentence fragments ("therefore", "inter alia", "pass", city names). Patna fails even though most entries are capitals, because names come glued to "ORAL" ("SUDHIR SINGHORAL"). Bench size is the number of names (the source's bench strength always equals the length of that list, so it is only as good as the list). Share of cases that show judges: Bombay 84.5%, Gujarat 64.1%, Orissa 44.5%. Spot check against the comparison screenshot: the two Bombay cases visible there carry the same judge names and the same single/division bench.
- **Supreme Court judges** are shown ("as listed in the source", 100% name-like) but **Supreme Court bench size is not**: 87% of cases would read "single judge", which is implausible for that court (the source seems to list only the authoring judge).
- **Party names** are shown only when both look like party names. Stripped first: a leading case reference ("WP(C)/19571/2019 of K.G.RAJU" becomes "K.G.RAJU") and trailing commas. A case is then left without parties (never half) if either value contains extraction junk: "picture [..] intentionally omitted", a leading `+ > $` or similar, an embedded case number such as 354/2024, a file name ending in .odt/.doc/.docx/.pdf, or more than 150 characters. Truncations such as "M/S ITD CEMINDIA (JV" cannot be detected and remain possible.
- **Disposition chip:** the source has 498 spellings. A chip is shown only for the 20 common, unambiguous values (Allowed, Dismissed, Disposed of, Rejected, Bail granted/rejected, Closed, Withdrawn, Partly allowed, Quashed, Remanded, Acquitted, Convicted, Granted, Dismissed as infructuous/withdrawn/on merits), about 92% of cases. Everything else appears only as recorded text on the detail page.
- **Pages:** the last page the extracted text reaches (max `page_end` over a case's chunks). Every case has it, and it never decreases along the text in 99.1% (Bombay) and 99.7% (Delhi) of cases checked; values above 2000 are dropped. It is the length of the extracted text, not an official page count.
- **Citation:** blank for every High Court (0%). The detail page says "No reporter citation is available for this record" and the case number is the main identifier.
- **Party names** are as extracted and can be truncated or contain fragments ("ITS GENERAL SECRETARY Through: None").

## Field fill rates by court (share of exported cases showing the field)
| Court | Cases | Case no. | Date | Disposition | Disposition chip | Parties | Judges | Pages |
|---|---|---|---|---|---|---|---|---|
| allahabad-high-court | 1,556,323 | 63.3% | 100.0% | 99.4% | 87.2% | 69.5% | 0.0% | 100.0% |
| andhra-pradesh-high-court | 261,773 | 98.6% | 99.4% | 99.5% | 88.4% | 90.4% | 0.0% | 100.0% |
| bombay-high-court | 1,578,864 | 99.0% | 99.5% | 99.3% | 94.5% | 92.6% | 84.5% | 100.0% |
| calcutta-high-court | 340,418 | 43.2% | 99.2% | 98.9% | 98.6% | 95.1% | 0.0% | 100.0% |
| chhattisgarh-high-court | 509,786 | 85.8% | 99.9% | 99.9% | 99.2% | 43.6% | 0.0% | 100.0% |
| delhi-high-court | 330,400 | 70.9% | 99.9% | 85.0% | 84.9% | 77.8% | 0.0% | 100.0% |
| gauhati-high-court | 286,466 | 75.3% | 99.6% | 94.3% | 93.8% | 81.4% | 0.0% | 100.0% |
| gujarat-high-court | 405,840 | 99.6% | 100.0% | 99.8% | 87.6% | 87.5% | 64.1% | 100.0% |
| high-court-of-jammu-and-kashmir-and-ladakh | 100,285 | 97.0% | 99.9% | 98.4% | 86.1% | 58.5% | 0.0% | 100.0% |
| himachal-pradesh-high-court | 254,825 | 98.9% | 99.2% | 98.8% | 97.0% | 90.1% | 0.0% | 100.0% |
| jharkhand-high-court | 420,729 | 99.8% | 99.7% | 99.7% | 76.1% | 78.6% | 0.0% | 100.0% |
| karnataka-high-court | 686,152 | 97.2% | 99.8% | 99.8% | 98.3% | 95.0% | 0.0% | 100.0% |
| kerala-high-court | 1,018,714 | 100.0% | 100.0% | 100.0% | 99.2% | 95.0% | 0.0% | 100.0% |
| madhya-pradesh-high-court | 646,344 | 87.2% | 100.0% | 100.0% | 99.6% | 88.5% | 0.0% | 100.0% |
| madras-high-court | 1,498,010 | 98.5% | 100.0% | 99.6% | 85.6% | 88.0% | 0.0% | 100.0% |
| manipur-high-court | 16,763 | 99.6% | 99.7% | 99.6% | 96.9% | 73.6% | 0.0% | 100.0% |
| meghalaya-high-court | 10,827 | 98.9% | 100.0% | 100.0% | 99.6% | 87.5% | 0.0% | 100.0% |
| orissa-high-court | 685,646 | 99.8% | 99.9% | 99.5% | 99.1% | 80.9% | 44.5% | 100.0% |
| patna-high-court | 1,614,936 | 100.0% | 99.6% | 98.3% | 97.4% | 81.9% | 0.0% | 100.0% |
| punjab-and-haryana-high-court | 1,133,710 | 52.4% | 99.8% | 99.9% | 99.8% | 97.0% | 0.0% | 100.0% |
| rajasthan-high-court | 1,056,767 | 95.6% | 100.0% | 99.7% | 98.9% | 51.2% | 0.0% | 100.0% |
| sikkim-high-court | 2,219 | 90.9% | 99.6% | 99.8% | 99.6% | 87.8% | 0.0% | 100.0% |
| telangana-high-court | 1,005,127 | 96.1% | 99.9% | 99.8% | 88.5% | 94.5% | 0.0% | 100.0% |
| tripura-high-court | 30,062 | 83.3% | 99.7% | 99.6% | 99.3% | 79.7% | 0.0% | 100.0% |
| uttarakhand-high-court | 205,475 | 91.2% | 99.9% | 99.5% | 99.3% | 90.0% | 0.0% | 100.0% |

Case number is the weakest identifier: Calcutta 43%, Punjab and Haryana 52%, Allahabad 63%, Delhi 71%. Delhi disposition is 85%. Judges: only the three gated courts are above 0%. Rajasthan has far more `case_id` values (1,056,767) than distinct case numbers (about 308,000), so its counts are records, not cases.

## Where the case pages are read from
`src/lib/judgments/hcData.ts`: `JUDGMENTS_DATA_DIR` (local folder, development) or `JUDGMENTS_DATA_URL` (https base serving the same layout). With neither set, High Courts are honestly count-only: `listable:false`, cards say "(counts by year only)", year cards are inert, copy says case lists are not available. The Supreme Court is bundled (`src/data/judgments/sc/*.json`, 12 MB) and always works.

## Commands (SSD attached)
```bash
scripts/judgments/export-judgments-hc.sh                      # full High Court export, about 3 minutes, needs the DuckDB CLI
HC_COURTS=delhi-high-court HC_YEARS=2024-2025 scripts/judgments/export-judgments-hc.sh   # a subset (does not refresh counts)
scripts/judgments/export-judgments.sh                         # Supreme Court case files (unchanged)
echo "JUDGMENTS_DATA_DIR=data/judgments-hc" > .env.local      # local dev and local production build
npm run build && npm start
```

## Production (Cloudflare R2, or any static host)
The folder is too big for the repo or a Vercel function, so production reads it from a bucket: set `JUDGMENTS_DATA_URL` to the bucket's public base URL (no code change, no dependency). Without it production High Courts stay honestly count-only.
```bash
scripts/judgments/export-judgments-hc.sh          # about 6 minutes, SSD attached
scripts/judgments/gzip-for-upload.sh              # data/judgments-hc-gz, about 2.3 GB, about 30 minutes (328,000 small files)
rclone copy data/judgments-hc-gz r2:lexbharat-judgments --header-upload "Content-Encoding: gzip" --header-upload "Content-Type: application/json" --transfers 32 --checkers 32 --progress
```
Uploading the uncompressed folder also works but is 11.7 GB (over R2's 10 GB free tier). The gzip upload relies on the objects being served with `Content-Encoding: gzip`, which `fetch()` decompresses transparently.

## Deferred, with the reason
| Item | Why it is not in this build |
|---|---|
| **Short text snippet** | No clean source. The `description` field is the first ~300 characters of the raw document (letterhead such as "IN THE HIGH COURT OF JUDICATURE AT BOMBAY BENCH AT NAGPUR", file names like "6391-2012.odt", "Page 1 of 4 $~24"); the first text chunk starts with the same boilerplate. A real preview needs a verified rule for finding the operative text of each court's judgments. |
| **Search by party name inside a High Court year** | A year can hold up to 158,000 cases in up to 1,600 files read 100 at a time. Name search needs an index (a database or search service), which is the hosting decision still open. Filters were possible without one because they are shaped at export time: each filter value has its own pre-built list. |
| **Combined filters** (disposition and bench together) | Each filtered list is pre-built, so only one filter applies at a time. Combining them would multiply the stored files. |
| **Supreme Court bench-size filter** | The source's bench field understates real benches (see above). |
| A way to find a High Court case from its id alone; judgment text; reporter citations for High Courts | No index; text not exported; the source has none. |

Filters are live: the Supreme Court (disposition, values from the year's data) and every High Court (disposition chips; bench size for Bombay, Gujarat and Orissa). Filter counts are exact because they are counted at export time.
