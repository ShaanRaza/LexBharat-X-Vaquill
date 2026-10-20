# Acts & Judgments: what was investigated, what is real, what is mocked

Added 2026-10-20. Route: `/workspace/browse` (and `/workspace/browse/judgments/<court>`). **Update:** the Acts tab now serves real act-level legislation metadata from the open-india-law dataset (see `docs/ACTS-PHASE1.md`); the Judgments tab and everything below about judgments is still mock or display data. The sections below describe the original mock build.

## Question
The original product has an "Acts & Judgments" area (Browse Laws & Judgments: Supreme Court, High Courts, years, an Acts & Legislation tab). Where does its data come from, is it reachable, and what can legitimately be recreated?

## What was and was not observable
| Item | Finding | Evidence |
|---|---|---|
| The page itself (Workspace app, `app.vaquill.ai`) | **Login-gated.** Opening it logged out redirects to `/auth/login?redirect=/dashboard`. | Observed redirect in the project's browser pane; the pane's earlier session had expired. |
| Its network requests, endpoints and JSON | **Not observed.** Inspecting them needs a signed-in session, which was not available. Nothing about the app's own requests is documented here, and none was invented. | n/a |
| The UI (layout, copy, court list, counts, year grid) | Taken from the three screenshots supplied by the project owner (their own signed-in browser). Only what is visible in them was recreated. | Screenshots |
| **Acts** data source | **Publicly documented.** The page's banner and the public docs say acts come from the **Data API's India acts endpoints**, mirroring India Code, the Government of India's official repository: 64,179 served acts, 745,970 distinct sections (public page "India legislation coverage"). The endpoints are API-key authenticated (`Authorization: Bearer ...`); a few are free. | Public docs: `/docs/api-guide/coverage/india` and `/docs/api-reference/indian-acts-and-legislation/*` (17 documented routes) |
| Acts list response shape | **Published.** `GET /api/v1/in/acts/list` with `category`, `state`, `department`, `yearFrom`, `yearTo`, `status`, `search`, `sort`, `page`, `pageSize (1-100)` returns `{ results[], total, page, pageSize, hasMore, meta, note }`; each result has `actId, title, year, category, department?, actNumber?, actStatus, enactmentDate?, citation, sectionCount`. | Public docs page "Browse and discover acts" |
| **Judgments** data source | **Unknown and not public.** The screenshot's own banner says case law and tribunal decisions are *not* in the API corpus; they can only be browsed in the app, with coverage to mid-2025. No public document describes where they come from. | Screenshot banner; public docs silent |
| Can the underlying dataset be extracted from what is exposed? | **No.** Public docs give shapes and counts for acts, never the corpus; for judgments nothing public exists. This project did not try to extract either. | |

Conclusion, plainly: the acts data comes from Vaquill's own API-key-protected Data API (a private backend corpus mirroring a public government source); the judgments browser is a signed-in app feature with no public endpoint; the real datasets are not accessible from anything public, and no real data was recovered.

## Why LexBharat had nothing there (root cause)
The page was never built. The local project recreated the public marketing site, the public docs and the **Data & API** developer console. The "Workspace" product area (New Chat, Acts & Judgments, WhatsApp Bot) is a different, signed-in app and had no route, no sidebar variant and no data. The only India content was the marketing page `/in` (stats and a jurisdiction table), which is not a browser.

## What was built (all mock)
| Part | File |
|---|---|
| Workspace variant of the console shell (pill "Workspace", New Chat / Data API / Acts & Judgments / WhatsApp Bot, Settings) | `src/components/console/ConsoleShell.tsx` (`variant="workspace"`) |
| Browse page: headline, "What the Data API covers" card, search, Judgments and Acts & Legislation tabs | `src/app/(console)/workspace/browse/page.tsx`, `src/components/workspace/BrowseLaws.tsx` |
| Court page with decade-grouped year grid (placeholder years) | `src/app/(console)/workspace/browse/judgments/[court]/page.tsx` |
| Mock acts list API shaped like the documented `/in/acts/list` | `src/app/api/mock/acts/list/route.ts` |
| Display and mock data | `src/data/workspaceBrowse.ts` |

## Still mocked or unknown
- All act rows are invented placeholders (real act titles and years, `MOCK_*` ids, placeholder section counts, no act text).
- Court counts are shown only for the six courts visible in the reference screenshot (Supreme Court ~41,000; Allahabad, Andhra Pradesh, Bombay, Calcutta, Chhattisgarh, Delhi). Other courts say "Count not captured". The list of 25 High Courts is general public knowledge, not copied data.
- The 14 Tribunals mentioned in the subtitle have no section (not seen in the screenshots).
- Year cards do nothing: no judgment lists, no judgment text, no citations.
- "Advanced Research", New Chat and WhatsApp Bot are not recreated.
- The original app's real requests and responses for this area remain unknown until someone with a signed-in session inspects them.
