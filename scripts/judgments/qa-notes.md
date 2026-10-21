# QA notes, 2026-10-21 (Supreme Court case pages)

Reports: `qa-report.md` (offline sweep of all 37,014 records, `npm run qa:sweep`) and `qa-live-report.md` (rendered pages on the live site, `npm run qa:live`, Chrome over the DevTools protocol because Playwright is not a dependency).

## Findings
1. **Bug, fixed:** the disposition label upper-cased the plural "IAs" to "IAS" ("Permission to File SLP/Appeal-allowed and matter dismissed(including all pending IAs)", 1 case). `src/lib/judgments/disposition.mjs` now keeps "IAs"; regression test "disposition labels..." in `npm run test:extract`. To let the sweep run the exact label code, `disposition.ts` became `disposition.mjs` plus `disposition.d.mts` (imports updated, no behaviour change).
2. **Flag reviewed, not a bug:** 1951_INSC_17 prints "(Civil Appeal No. 95 of 1949)". The sweep's plausible range starts at 1950 as specified, but the heading really says 1949 (an appeal numbered before the Court's first year, decided in 1951). Listed as reviewed in the sweep.
3. **Production was behind the repo, now resolved:** the first live run passed 28 of 30 pages. The two failures (2016_INSC_586 and 2025_INSC_1288, Mihir Rajesh Shah) were benches added by commit 751049c (CJI / single-J headings, initials-based authoring check), which had not been pushed. After pushing 751049c and 426016c, the same live check passes **30 of 30** (`qa-live-report.md` is that second run); the local build also passed 30 of 30.
4. No crashes, no undefined/NaN/empty text, no empty value cells, no missing provenance panels, no broken back links in either run.
