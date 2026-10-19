# Bundle notes: what is in `lexbharat-docs.zip`, what was left out, and why

Last rebuilt 2026-10-20 after the docs-shell rebuild (earlier the same day: release-readiness pass). This file is in the zip.

## What the zip contains
| Group | Files |
|---|---|
| Overview | `README.md` |
| Docs | `docs/ARCHITECTURE.md`, `ASSUMPTIONS-AND-UNKNOWNS.md`, `BUNDLE-NOTES.md` (this file), `DATA-FLOW.md`, `DOCS-SHELL.md`, `PAGES-AND-DATA-MAP.md`, `PLAYGROUND-BUILD.md`, `PUBLIC-EVIDENCE.md`, `SCREENSHOTS.md` |
| Audit evidence | `playground-evidence.md` |
| QA reports | `qa/QA-REPORT.md` (with Addendum 2), `qa/QA-LOG.md` |
| QA scripts | `qa/playground-qa.mjs`, `qa/cdp-audit.mjs`, `qa/keyboard-test.mjs`, `qa/crawl_routes.py`, `qa/audit_static.py`, `qa/analyze_logs.py`, `qa/release_markers.py`, `qa/layout-audit.js`, `qa/sweep.sh` |
| QA inputs and results | `qa/*.txt` route lists, `qa/logs/*`, `qa/playground-prod/report.json` (latest production Playground run: 4 widths, 0 problems) |

Not in the zip: all images (`docs/screenshots/`, `qa/screenshots/`, `qa/prod*`, `qa/playground/*.jpg`, `qa/us-map-after.jpg`), `node_modules`, `.next`, and source code. Consequence: the image links in `docs/SCREENSHOTS.md` only resolve inside the project.

## Withheld on purpose (both stay in the project, unedited)

### `docs/PLAYGROUND-TEARDOWN.md`
A write-up made from a logged-in session on `app.vaquill.ai`: the account's state at the time (credit balance, "no API key"), the authenticated console layout and behaviour, the internal `/api/playground/spec` and `/api/playground/run` request and response shapes with header names, the 33-endpoint catalog with field-level detail, and the pricing table as served to that session. No passwords, tokens, cookies, keys or email addresses (checked), but it documents a third party's non-public surface in rebuild-level detail from one person's account, and a zip cannot be recalled once shared. Withholding is reversible; sharing is not.

### `recut-evidence.md` (changed from the previous rebuild, which included it)
It is a **negative result** (no Recut artifact exists on this machine) and contains no findings someone else could use, but it does contain: this Mac's username and working-directory path, the names of installed applications, the names of sibling project folders, and the fact that personal folders (Downloads, Documents, Library) were listed by name. That is local-environment disclosure with no offsetting value for a recipient. Conservative decision: **exclude it from the distributable**. If you want recipients to know the Recut audit ran, the one-line summary is: "Recut audit (2026-10-20): no Recut artifact was found on the machine; the search covered Spotlight, all app bundles, the home folder, package managers, processes and the project tree." Add the full file back by hand only if the bundle stays inside your organisation.

## Risk decisions made in the release-readiness pass
| Risk | Decision | Why |
|---|---|---|
| Invented non-Pricing endpoint response shapes (24 endpoints) | **Acceptable, with the label** | Every screen and every body says it is a mock (always-on banner, "Local mock" badge, "Mock key", "Mock" pill on responses, `_mock` and `_note` in each body, "(local mock)" in the tab title; all verified in the production HTML and by `qa/playground-qa.mjs`). `PLAYGROUND-BUILD.md` section 5 and `playground-evidence.md` say the shapes are inferred. It would not be acceptable to describe them as the real API contract. |
| `federal` accepted beyond search (count, resolve GET/POST, extract-citations, coverage, boards) | **Acceptable** | Only search is confirmed; the rest is a mock behaviour documented as inferred, it is rejected where it would be wrong (divisions, session-law jurisdiction), and nothing real depends on it. Verify against the live product before treating it as fact. |
| `SCREENSHOTS.md` and `QA-REPORT.md` stale | **Not acceptable; fixed** | Both now carry a freshness note, and a new section 5 (console screenshots) and Addendum 2 (current counts, production results, findings). The original marketing-site body of `QA-REPORT.md` is kept as the record of that pass. |
| `recut-evidence.md` in the bundle | **Removed** (see above) | Local-environment disclosure, no findings. |
| Placeholder legal copy ("Placeholder", "this build / local build" on 10 pages) | **Acceptable, caveat** | Honest labels, not presented as real policy; not lawyer-reviewed. Replace before any public launch. |
| Not tested: other browsers, real phones, screen readers, performance, `npm audit` | **Accepted, caveat** | Out of scope for this pass; listed in `QA-REPORT.md`. |
