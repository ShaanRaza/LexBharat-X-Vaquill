> **Note (2026-10-28):** this document describes the first, mock-only build of the project. The product has since grown real Acts, judgments, Chat, Drafting, Review and Vault features on Neon, Supabase and AI providers. For the current state read the main [README](../README.md), [`DATA-GAPS.md`](DATA-GAPS.md) and the work-package notes ([`W8.md`](W8.md), [`W9.md`](W9.md), [`W10.md`](W10.md)).

# Data flow: where data lives and how it reaches the screen

There are only **four places** data can come from in this project. Every page uses one or more of them.

| # | Source | Where it lives | Changes while running? |
|---|---|---|---|
| 1 | **Static data files** | `src/data/*.ts` (and `src/data/docs/`) | No (edit the file and the page updates) |
| 2 | **Hardcoded copy** | inside `src/components/*.tsx` and page files | No |
| 3 | **Mock API routes** | `src/app/api/mock/**/route.ts` | Responses are computed per request |
| 4 | **Simulated database** | `src/lib/mockStore.ts` (memory only) | Yes, but resets when the server restarts |

Nothing is ever written to disk and no request leaves your computer (apart from the development-time font download).

## 1. Static data files

| File | Contains | Origin of the content |
|---|---|---|
| `jurisdictions.ts` | 51 map tiles: code, name, statute-section count, grid position | Counts observed on the public home page; the grid layout is original |
| `endpoints.ts` | 12 API endpoints (method, path, summary, credits) | Paths as printed publicly; summaries paraphrased; credit numbers invented |
| `mcpTools.ts` | 13 tool names, 5 client setups, 10 plugin commands | Names as printed publicly; descriptions paraphrased; snippets illustrative |
| `corpus.ts` | 8 made-up law "sections" | **Entirely invented** (stand-in for the real database) |
| `india.ts` | India stats, 13 jurisdictions, 44 body names | Figures/names as shown on the public India page |
| `company.ts` | Founders, one customer story, data sources, brand colors | **Fictional** people/customers; colors are this app's tokens |
| `hubs.generated.ts` | **Every title in the five content hubs** (459 blog, 24 engineering, 52 clauses, 10 topics, 4 playbooks) with category for clauses/playbooks | Titles from the public listing pages and sitemap slugs (generated once by a script; see below) |
| `hubs.ts` | Wraps the generated list; adds placeholder summaries | Original placeholder text |
| `legal.ts` | 9 legal pages, 109 sections (with subsections) | Heading structure follows the public pages; **all wording is placeholder** |
| `extraPages.ts` | Ethics, vulnerability-disclosure and use-case outlines; Word add-in features and install steps | Headings observed; wording original |
| `site.ts` | Nav and footer link lists | Structure observed on the public site |
| `docs/nav.ts` | Docs sidebar tree (11 sections, 58 entries, endpoint slugs) | Observed public docs navigation + the 12 endpoints |
| `docs/pages.ts` | 43 written guide pages + Integrations + 2 URL aliases | Original explanatory text using observed field names and paths |

**How it reaches the screen:** a page imports the file, loops over the array, and renders cards/tables. Example: `jurisdictions.ts` → `CoverageMap.tsx` → one button per tile. Example: `hubs.generated.ts` → `hubs.ts` → `HubList.tsx` (search/filter/pagination in the browser) and `blog/[slug]/page.tsx` (one static page per entry).

### How `hubs.generated.ts` was made

A one-off script read the public sitemap (to get every URL slug) and the public listing pages (to get titles and categories), matched them, and wrote the TypeScript file. The public one-line blurbs and article bodies were **not** copied. Titles that could not be tied to a slug were derived from the slug. The script is not part of the repo; to change the lists, edit the generated file directly.

## 2. Hardcoded copy

Marketing text that is not worth a data file (hero sentence, FAQ answers, pricing bullets, page leads) is written directly in the component or page, for example the home page's FAQ and pricing in `src/components/PricingFaq.tsx`.

## 3. Mock API routes (`/api/mock/...`): which route powers which screen

| Route | Screens that call it | What it does | Data it uses |
|---|---|---|---|
| `POST /api/mock/subscribe` | Footer newsletter form (every page) | Checks the email shape, returns "nothing saved" | none |
| `GET /api/mock/resolve?cite=` | Home-page API demo | Looks up a citation in the made-up corpus | `corpus.ts` |
| `POST /api/mock/playground` | `/playground` | Returns a canned response plus random request id, latency and credits | `corpus.ts`, `endpoints.ts` |
| `GET/POST/DELETE /api/mock/watches` | `/alerts` | Lists, creates and deletes watches. Validates the target (email, or an `https://` URL for webhooks), caps it at 200 characters and the list at 50 entries | **`mockStore.ts`** |
| `POST /api/mock/forms/contact` | `/contact` | Checks required fields; returns a success message | none (stores nothing) |
| `POST /api/mock/forms/legal-aid` | `/legal-aid` | same | none |
| `POST /api/mock/forms/affiliate` | `/affiliates` | same | none |
| `POST /api/mock/forms/delete-data` | `/delete-data` | same (deletes nothing) | none |
| `POST /api/mock/forms/login` | `/auth/login`, `/auth/forgot-password` | Validates the email; success message saying no accounts exist. On `/auth/login` the browser then stores a **mock session** (the email, `localStorage` key `lb_mock_session`, this browser only) and goes to `/developer?tab=playground`; the console shows "Signed in (mock)" with a Sign out (mock) button. Nothing is verified, sent or gated by it | `lib/mockSession.ts`, `MockForm.tsx` (`mode="signin"`) |
| `POST /api/mock/forms/signup` | `/auth/signup` | same | none |
| `POST /api/mock/search` | **No screen calls it** (kept for testing; the Playground uses the same search function directly) | Keyword search over the made-up corpus | `corpus.ts` |
| `GET /docs/llms.txt` | Linked from nowhere; public-docs-style text index | Plain-text list of the docs sidebar | `docs/nav.ts` |

Every mock JSON response includes `"_mock": true` so it can never be mistaken for real output.

### 3b. Developer-console Playground routes (`/api/playground/...`)

| Route | Screens that call it | What it does | Data it uses |
|---|---|---|---|
| `GET /api/playground/spec?jurisdiction=US` | `/developer?tab=playground` | Returns the mocked endpoint spec (33 endpoints, 25 runnable); other jurisdictions return an empty list | `data/playgroundSpec.ts` |
| `POST /api/playground/run` | `/developer?tab=playground` | Validates key, required fields, enums and ranges, waits 350 to 800 ms, then returns `{status, ok, body, meta}` with an endpoint-specific invented body (Pricing is the confirmed shape) | `lib/playgroundMock.ts`, `lib/playgroundFixtures.ts`, `data/playgroundSpec.ts`, `data/stateBreakdown.ts` |

The mock API key lives in the browser's `localStorage`; Recent runs live in `sessionStorage`. Nothing is stored on the server.

## 4. Simulated database (`src/lib/mockStore.ts`)

A plain JavaScript array held in the server process. It starts with one example watch. Creating or deleting a watch on the **Alerts** page changes that array. Stopping and restarting the server resets it. It is the only stateful thing in the project.

## Browser-only state

Some things change only in your browser tab and are never sent anywhere: the map's hover/zoom/layer tab, the FAQ accordion, the hero headline cycle, docs and blog search text, blog page number, category filters, MCP client tabs and form field values.

## Walk-throughs

**Home-page API demo:** press **Run (mock)** → browser calls `GET /api/mock/resolve?cite=…` → the route searches `corpus.ts` → returns JSON marked `_mock` → `AccessAndDemo.tsx` shows a card or raw JSON.

**Creating an alert:** `/alerts` loads watches with `GET /api/mock/watches` → you press **Create watch** → `POST` adds to the array in `mockStore.ts` → the list reloads → restart the server and it is gone.

**Blog search:** `/blog` renders a static page with all 459 titles → typing in the box filters them **in the browser** → no request is made.

**Docs search:** typing in the top-bar box filters the 58 sidebar titles in the browser (`DocsShell.tsx`).

## What the real site does differently (as far as is publicly knowable)

- The real home page is largely pre-built static HTML; its numbers are baked in, as here.
- The real API lives on separate hosts and needs a key; this project has none of that.
- Real hubs have full article bodies; here only titles are real.
- See [`PUBLIC-EVIDENCE.md`](PUBLIC-EVIDENCE.md) and [`ASSUMPTIONS-AND-UNKNOWNS.md`](ASSUMPTIONS-AND-UNKNOWNS.md).
