# Screenshots of the local build

> **Scope and freshness (2026-10-20).** The numbered tables below (D01 to D31, M00 to M19) are PNGs of the **marketing site** taken before the later changes. The images are not in `lexbharat-docs.zip` (they live in `docs/screenshots/` in the project), so the links below only resolve inside the project. The home-page map in those shots is the old tile-grid map; the current map is a geographic state map with hover cards (see `qa/us-map-after.jpg`, taken right after the rebuild, before the tooltip was added). The route counts in this file (582) are those of the original marketing-site pass; the current build has 651 audited HTML routes and 666 static pages (see `qa/QA-REPORT.md` Addendum 4). The docs pages in the numbered tables predate the docs-shell rebuild (see `docs/DOCS-SHELL.md`). The developer-console Playground clone is **not** covered by the numbered tables; its screenshots are in section 5 below.

Saved from the running app at `http://localhost:3100` with a headless Chrome. **Desktop** shots are 1280 px wide (the first 1500 px of each page); **mobile** shots are 390 px wide (the first 1700 px).

Numbers **D00–D31** and **M00–M18** are used by [`PAGES-AND-DATA-MAP.md`](PAGES-AND-DATA-MAP.md).

## Desktop

| # | Screenshot | Page |
|---|---|---|
| D00 | ![](screenshots/desktop/00-home.png) | `/` Home |
| D01 | ![](screenshots/desktop/01-legal-api.png) | `/legal-api` Statutes API |
| D02 | ![](screenshots/desktop/02-mcp.png) | `/mcp` |
| D03 | ![](screenshots/desktop/03-playground.png) | `/playground` before running |
| D04 | ![](screenshots/desktop/04-playground-after-run.png) | `/playground` after **Run request** (mock response) |
| D05 | ![](screenshots/desktop/05-alerts.png) | `/alerts` (simulated database) |
| D06 | ![](screenshots/desktop/06-open-us-law.png) | `/open-us-law` |
| D07 | ![](screenshots/desktop/07-legal-aid.png) | `/legal-aid` |
| D08 | ![](screenshots/desktop/08-india.png) | `/in` |
| D11 | ![](screenshots/desktop/11-sign-in.png) | `/auth/login` (mock) |
| D12 | ![](screenshots/desktop/12-docs-home.png) | `/docs` home with the four docs tabs and the full sidebar |
| D13 | ![](screenshots/desktop/13-docs-quickstart.png) | `/docs/api-guide/quickstart` |
| D14 | ![](screenshots/desktop/14-word.png) | `/word` Word add-in page |
| D15 | ![](screenshots/desktop/15-word-sideload.png) | `/word/sideload` install guide |
| D16 | ![](screenshots/desktop/16-slack.png) | `/slack` redirect shell |
| D17 | ![](screenshots/desktop/17-ethics.png) | `/for-lawyers/ethics` |
| D18 | ![](screenshots/desktop/18-vulnerability-disclosure.png) | `/security/vulnerability-disclosure` |
| D19 | ![](screenshots/desktop/19-use-case.png) | `/use-case/legal-tech-developers` |
| D20 | ![](screenshots/desktop/20-blog-full.png) | `/blog`: full list (459 entries) |
| D21 | ![](screenshots/desktop/21-blog-search.png) | `/blog` after typing a search |
| D22 | ![](screenshots/desktop/22-clauses.png) | `/clauses` (52 entries, category filter) |
| D23 | ![](screenshots/desktop/23-privacy.png) | `/privacy` structured legal page |
| D24 | ![](screenshots/desktop/24-security.png) | `/security` |
| D25 | ![](screenshots/desktop/25-docs-point-in-time.png) | `/docs/api-guide/point-in-time` |
| D26 | ![](screenshots/desktop/26-docs-citation-formats.png) | `/docs/api-guide/concepts/citation-formats` |
| D27 | ![](screenshots/desktop/27-docs-api-reference.png) | `/docs/api-reference` |
| D28 | ![](screenshots/desktop/28-docs-endpoint.png) | an endpoint reference page |
| D29 | ![](screenshots/desktop/29-docs-integrations.png) | `/docs/integrations` |
| D30 | ![](screenshots/desktop/30-brand.png) | `/brand` with original logo files |
| D31 | ![](screenshots/desktop/31-contact.png) | `/contact` |

## Mobile

| # | Screenshot | Page |
|---|---|---|
| M00 | ![](screenshots/mobile/m00-home.png) | `/` |
| M01 | ![](screenshots/mobile/m01-playground.png) / ![](screenshots/mobile/m01-playground-after-run.png) | `/playground` before / after a run |
| M02 | ![](screenshots/mobile/m02-alerts.png) | `/alerts` |
| M04 | ![](screenshots/mobile/m04-docs.png) | `/docs` |
| M05 | ![](screenshots/mobile/m05-login.png) | `/auth/login` |
| M10 | ![](screenshots/mobile/m10-word.png) | `/word` |
| M11 | ![](screenshots/mobile/m11-slack.png) | `/slack` |
| M12 | ![](screenshots/mobile/m12-blog.png) | `/blog` (full list) |
| M13 | ![](screenshots/mobile/m13-privacy.png) | `/privacy` |
| M14 | ![](screenshots/mobile/m14-docs-quickstart.png) | `/docs/api-guide/quickstart` |
| M15 | ![](screenshots/mobile/m15-docs-endpoint.png) | endpoint reference page |
| M16 | ![](screenshots/mobile/m16-brand.png) | `/brand` |
| M17 | ![](screenshots/mobile/m17-ethics.png) | `/for-lawyers/ethics` |
| M18 | ![](screenshots/mobile/m18-contact.png) | `/contact` |
| M19 | ![](screenshots/mobile/m19-security.png) | `/security` (after the mobile table-overflow fix) |

## QA screenshots

The pre-launch QA pass saved a full-page screenshot of **every** route: `qa/screenshots/desktop` (582), `qa/screenshots/mobile` (582, true 390 px device emulation) and `qa/screenshots/tablet` (111). File names are the route with `/` replaced by `__` (`/` = `home.jpg`). See `qa/QA-REPORT.md` section 8.

## Notes

- D09, D10 and M03 do not exist: they showed earlier, smaller versions of pages that have since been replaced, so they were deleted (see D20, D24 and M12 for the final blog and security pages).
- The small circular **N** and the red **"1 Issue"** pill are Next.js's development overlay, not part of the design. In automated screenshots the "issue" is a hydration notice caused by the screenshot tool itself (it injects a `caret-color` style into inputs); see `ASSUMPTIONS-AND-UNKNOWNS.md`, section 5.
- Pages with no screenshot (for example `/about`, `/terms`, `/clauses/<slug>`) use the same templates as the pages shown.
- To refresh a shot, run a capture and overwrite its file in `docs/screenshots/`.


## 5. Developer console (Playground clone), production build, 2026-10-20

Produced by `node qa/playground-qa.mjs` against `npm run build && npm run start` on port 3100. Full-page JPEGs (2x) in `qa/playground/`, named `<breakpoint>-<NN>-<state>.jpg`. Not in the zip.

| State | File suffix | Breakpoints |
|---|---|---|
| Initial (Pricing, free endpoint) | `01-initial` | mobile-360, mobile-390, tablet-820, desktop-1280 |
| Narrow-screen drawer open | `02-drawer` | mobile-360, mobile-390 |
| Endpoint picker open | `03-picker` | all four |
| Search statutes, no key yet (banner, disabled Run) | `04-search-gated` | all four |
| Running (Cancel + timer + skeleton) | `05-running` | all four |
| Results (mock search hits, "Mock" pill) | `06-results` | all four |
| Code tab, JavaScript (gutter, highlighted key, missing-comma bug) | `07-code-js` | all four |
| Pricing results (31 rows) | `08-pricing` | all four |

`qa/playground/report.json` holds the pass/fail data (0 problems at all four widths). The screenshots show the always-on mock banner, the "Local mock" badge, and the greyed "Not in clone" sidebar items.
