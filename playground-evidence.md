# Playground evidence: LexBharat local app vs the real Vaquill Playground

Target: `http://localhost:3100/developer?tab=playground` (the local, mocked Playground clone). Written 2026-10-20. Audit only: nothing was built, refactored or rebuilt, and nothing was sent to Vaquill, billing, credits or any real API key.

**Label legend** (every finding below carries exactly one):
`[SEEN]` seen in the local app · `[CODE]` confirmed in code · `[WORKED-OUT]` worked out from what you saw · `[TEARDOWN]` documented from existing teardown notes · `[UNKNOWN]` still unknown

> **Post-audit update (2026-10-20, after the fix pass).** This file is the audit as written; it is not rewritten. The fix pass in `docs/PLAYGROUND-BUILD.md` section 5 changed these findings: mock notices are now visible in production builds (summary item 1 under "Things to know before sharing" no longer applies); Credits & Usage, Billing and Settings are intentionally disabled and Law Change Alerts and MCP Server are bridge pages (section 3 and gap 12); `federal` is a valid `state` option (gaps 12 and section 13); every endpoint has its own mock response shape (section 10 "Shape sharing" no longer applies); and `lexbharat-docs.zip` was rebuilt and now **excludes** both `PLAYGROUND-TEARDOWN.md` and `recut-evidence.md` (summary items 2 and 3 and section 15 no longer apply). A later release-readiness pass also fixed map keyboard focus. See `docs/BUNDLE-NOTES.md` and `qa/QA-REPORT.md` Addendum 2.

---

## ONE-PAGE SUMMARY

**What exists.** A working local Playground at `/developer?tab=playground` inside a small console shell (sidebar, top bar, Overview, API Keys). It has an endpoint picker fed by a mocked spec (33 endpoints, 25 runnable), spec-driven parameter forms, mock API-key gating, Run with Cancel and a live timer, Visual and JSON output, cURL / Python / JavaScript snippets, Recent runs, Copy link, a 4-step help tour, validation and a modal drawer on narrow screens. `[SEEN]` `[CODE]`

**What is real vs mocked.** Everything behind the screen is mocked: the spec (`/api/playground/spec`), the run proxy (`/api/playground/run`), the API key (a random string in localStorage), the credit balance and every response body. Only the Pricing body and the 401 body are copied from live findings; the other 24 runnable endpoints return invented fixtures marked `_mock: true`. `[CODE]` `[SEEN]`

**Verified locally.** An REA browser scenario against the running production build completed 10/10 steps with no console or page errors (Ctrl+Enter runs a request; picker, tabs, key banner work). `qa/playground-qa.mjs` passed at 360, 390, 820 and 1280 px on dev and production. All 25 runnable endpoints were probed over HTTP. `[SEEN]`

**Where it differs from the real product** (known now): response shapes for all 24 non-Pricing runnable endpoints; 15 of those mock bodies are copies of three shapes (six `session-laws` endpoints share one, six section sub-endpoints share the metadata shape, `resolve` x2 and `extract-citations` share one); multi-select and `federal` are missing from enum fields; descriptions are paraphrased; picker names for most endpoints are guessed; tour, Copy link payload, validation text, drawer and the Overview / API Keys screens are inventions; sidebar width, icons and logo are approximations; Settings and four other sidebar tabs are placeholders or dead links. `[CODE]` `[TEARDOWN]`

**Biggest unknowns.** Real paid response/error shapes (402/422/429, rate-limit headers); what the live tour, Copy link and validation actually do; live narrow-screen layout; the live Cancel mechanism; whether the live Code tab highlights the key in cURL/Python. `[UNKNOWN]`

**Things to know before sharing.**
1. In a release (production) build every "mock" notice is hidden, so the Vaquill-branded console shows no on-screen sign that it is a local clone (the served HTML has no "Internal REA clone" text). `[SEEN]` `[CODE]`
2. `lexbharat-docs.zip` is current for the 11 files it holds (byte-identical to disk) and does include the two Playground docs, but the older docs (`ARCHITECTURE`, `DATA-FLOW`, `PAGES-AND-DATA-MAP`, `SCREENSHOTS`, `ASSUMPTIONS`, `QA-REPORT`) predate the console and never mention it; the zip also lacks this file and the Playground QA script and report. `[SEEN]`
3. The zip contains `PLAYGROUND-TEARDOWN.md`, which records findings from a logged-in Vaquill session. `[SEEN]`

---

## DETAILED EVIDENCE

### 1. Method and sources
- REA browser scenario capture (provider "REA Playwright browser scenario capture provider", evidence `ev_292d206cca13859118d0ee5dc091bda43fab9b59b29d091c3c19ee7ea6fd8e65`, 2.1 s) against the running production build at `http://localhost:3100/developer?tab=playground`: wait for picker; press Control+Enter; wait for the output heading; click tabs JSON, Code, JavaScript; open picker; pick "Search statutes"; wait for the "Create API key" button. All 10 steps completed. Network events: page, `_next` chunks, one `GET /api/playground/spec?jurisdiction=US` (200) and one `POST /api/playground/run` (200). No console events and no page errors were retained. REA could not retain request/response bodies for these (`not_exposed`/`not_requested`), so body shapes below come from direct HTTP probes. `[SEEN]`
- HTTP probes of all 33 spec endpoints through `/api/playground/run` and the spec route, with and without a key and with and without required values. `[SEEN]`
- `node qa/playground-qa.mjs` results (`qa/playground/report.json`, `qa/playground-prod/report.json`): 0 problems and 0 console errors at all four widths. `[SEEN]`
- Source files listed in section 2, read directly. `[CODE]`
- `docs/PLAYGROUND-TEARDOWN.md` and `docs/PLAYGROUND-BUILD.md`. `[TEARDOWN]`
- No live Vaquill access was used in this step.

### 2. Files that implement each part
| Part | Files |
|---|---|
| Route and page title (`Developer API & MCP Server | Vaquill`, noindex) | `src/app/(console)/developer/page.tsx`, `src/app/(console)/layout.tsx` |
| Tab router, Overview, API Keys, placeholders | `src/components/console/DeveloperConsole.tsx` |
| Console shell (sidebar, top bar, drawer, dev banner) | `src/components/console/ConsoleShell.tsx` |
| Playground UI (picker, forms, run, output, code, recent runs, tour) | `src/components/console/PlaygroundApp.tsx` (547 lines) |
| Accessible select / grouped picker | `src/components/console/Listbox.tsx` |
| Spec fixture (33 endpoints, fields, enums, credit costs, pricing rows) | `src/data/playgroundSpec.ts` |
| Mock spec endpoint | `src/app/api/playground/spec/route.ts` |
| Mock run endpoint (delay, envelope) | `src/app/api/playground/run/route.ts` |
| Mock response logic, key gate, 404/422 | `src/lib/playgroundMock.ts` |
| Request builder and cURL/Python/JavaScript generator | `src/lib/playgroundCode.ts` |
| Mock API key (localStorage hook) | `src/lib/useMockKey.ts` |
| Console design tokens, animations | `src/app/globals.css` (`.console`, `.console-pop`, `.console-skel`) |
| Release toggle for mock notices | `src/lib/release.ts`, `src/components/DevOnly.tsx`, `src/components/MockBadge.tsx` |
| QA automation | `qa/playground-qa.mjs` |
| Docs | `docs/PLAYGROUND-TEARDOWN.md`, `docs/PLAYGROUND-BUILD.md`, `README.md` |

### 3. Every user-facing control
**Shell** (`ConsoleShell.tsx`)
- Sidebar links: Overview, Playground, Law Change Alerts (Beta chip), API Keys, Credits & Usage, Billing, MCP Server, each linking to `/developer?tab=<id>`. `[CODE]` `[SEEN]`
- Learn links: API Docs → `/docs`, Coverage → `/#coverage`, MCP Guide → `/mcp`, Open dataset → `/open-us-law` (local pages, not the live site). `[CODE]`
- Settings link → `/developer?tab=settings`, which has no screen and falls back to Overview. `[CODE]`
- User block "Local User / local@example.test": static text, not a control. `[CODE]`
- Sidebar chevron: collapses the desktop sidebar; in the drawer it closes it. Hamburger: opens the drawer below 768 px, toggles the sidebar at 768 px and above (label switches "Open menu" / "Show sidebar"). `[CODE]` `[SEEN]`
- "PRODUCT · Data & API" pill and US flag: static, not interactive (no menu). `[CODE]`
- Dev-only (hidden in release builds): orange banner "Internal REA clone of the Vaquill developer console…", "LOCAL CLONE" badge (hidden below 640 px). `[CODE]`
- Drawer (below 768 px): modal dialog, focus moves to the dialog, Tab trapped, Escape closes, page scroll locked, closes when resized to desktop. `[CODE]` `[SEEN]` (QA script)

**Playground** (`PlaygroundApp.tsx`)
- Copy link: copies `<origin>/developer?tab=playground&endpoint=<id>` and toasts "Link copied". `[CODE]`
- "?" button (aria-label "Walk me through Playground"): 4-step tour dialog (Pick an endpoint, Fill in the parameters, Run it, Read and copy) with Skip / Back / Next / Done and Escape to close. `[CODE]`
- Endpoint picker, key banner, primary field, example chips, parameter fields, Run/Cancel, footer hints, privacy notice with "What we store" link to `/security`, Recent runs (rows, Clear), Output|Code tabs, Visual|JSON tabs, cURL|Python|JavaScript tabs, copy buttons (code, response), toast, hidden status announcer. Details in sections 4 to 9. `[CODE]` `[SEEN]`
- Keyboard: Ctrl or Cmd + Enter anywhere inside the form runs the request (when allowed). `[CODE]` `[SEEN]` (REA step `s02-run-shortcut`)
- There is no settings panel, theme switch or preference storage in the Playground itself. `[CODE]`

**Overview / API Keys / other tabs** (`DeveloperConsole.tsx`): Overview shows a fixed "1,000 credits / Pay as you go (mock)" card, an API key card (Create a key, Manage ↗) and a Get started link; API Keys shows the masked mock key with "Delete mock key", or "Create API key"; the other four tabs show a one-line "outside the Playground clone" placeholder; unknown `tab` values fall back to Overview. `[CODE]`

### 4. Endpoint selection
- On load the component fetches `GET /api/playground/spec?jurisdiction=US`; failure shows an alert with Retry; loading shows a skeleton. `[CODE]` `[SEEN]`
- Only `runnable: true` endpoints are listed (25 of 33); the 8 watch endpoints (`/watches*`) are hidden; `/boards` and `/credits/balance` are runnable. `[SEEN]` (QA asserts exactly 25 options) `[CODE]`
- Grouping: tag headings (Pricing, US Statutes, US Session Laws, Board Watches, Credits) and, inside Statutes and Session Laws, grey sub-headings (Search, Section Lookup, Citations, Browse / Search, Lookup, Browse) from the `group` field. `[CODE]` The sub-heading names and endpoint display names, except five, are invented. `[TEARDOWN]`
- Option content: method badge, name, mono path, one-line summary. Keyboard: Arrow keys, Home, End, Enter/Space, Escape, type-ahead on the endpoint name. `[CODE]`
- Selecting an endpoint clears the visible result and cancels a running request; each endpoint's form values are remembered for the session in memory. The URL does not change. `[CODE]`
- `?endpoint=<id>` in the URL preselects an endpoint on first load if it is runnable; unknown ids are ignored. `[CODE]`
- Default endpoint is Pricing. `[CODE]`

### 5. Spec-driven form rendering
- The first required `textarea` field becomes the **primary field**: a large box with the credit chip (for example "4 credits") and Run inside it, with `Parameters` and example chips below. Search is the main case (`query`, max 500 chars); `extract-citations.text`, `session-laws/search.query` and the `session_law_id` path field of the two single-act session-law endpoints are also primary (so that path id is rendered as a large box). Endpoints without one show the endpoint summary at the top and Run below the fields. `[CODE]` `[SEEN]`
- Control by `kind`: `enum` → select with "Any" plus tokens (single-select only; shows the default in mono); `number` → input with min/max range label, optional preset chips (limit 1/5/10/20/50, offset 0/5/10/20/70, excerptChars 100/500/4000, years 1700/2100); `boolean` → switch (untouched shows "default: false", touching sends an explicit value); `date` → date input; `text` → input; `textarea`/`array`/multi text → "one per line" textarea with a value counter. `[CODE]`
- Labels: special names (`corpusType` → Corpus, `state` → Jurisdiction, `limit` → Results per page, `offset` → Skip, `includeBody` → Include first page of text, `query`, `region`), otherwise camelCase split. `[CODE]`
- Descriptions over 220 characters or with an enum legend are clamped with a Show more / Show less toggle; `corpusType` shows a scrollable `TOKEN description` legend. Backtick text renders as inline code. `[CODE]`
- Required non-primary fields get a red asterisk; the disabled Run explains the first missing field ("Query is required to run this request.", "Act id is required…"). `[SEEN]` `[CODE]`
- Seeded value: only the search form starts with `limit` = 5 (spec default is 10), so Code shows `"limit": 5`. `[CODE]`
- Validation (inferred wording): numbers must be numeric, whole when `integer`, and within `min`/`max`; an inline error appears, the field is marked invalid and Run is blocked (QA sets limit 999). `[SEEN]` `[CODE]`
- Values sent: only filled fields, coerced (numbers, booleans, one-per-line lists → arrays; multi text with one line → string). `[CODE]`
- Spec field attributes honoured: `name, in, kind, required, description, enum, enumLabels, example, default, min, max, integer, multi, presets, maxLength, examples`. Attributes in the live spec that are not in the local spec: `minLength`, `minItems`, `maxItems` (declared in the teardown field-key list, unused locally). `[CODE]` `[TEARDOWN]`

### 6. API key gating
- Endpoints with `auth: true` (24 of 25 runnable; only Pricing is `false`) and no key show the banner "Create API key to start" with a **Create API key** button, a disabled Run, and the footer line "Create an API key above to run this request." `[SEEN]` `[CODE]`
- Create API key generates `vq_mock_<24 hex>` with `crypto.getRandomValues`, stores it in `localStorage` (`lb_playground_mock_key`) and toasts "Mock API key created. It lives only in this browser." The banner disappears at once. The key is shared across tabs via a `storage` event and a custom event. `[CODE]` `[SEEN]`
- The key goes to the local mock only (`apiKey` in the run body, `null` for Pricing). The mock accepts any non-empty string and returns 401 `"An API key is required for this endpoint."` for a missing key. `[CODE]` `[SEEN]`
- Overview and API Keys screens also create/delete the same mock key. A mock key is never validated, rate-limited or tied to credits. `[CODE]`
- Teardown says the live banner copy is "One click. The key works here and anywhere else you need it, and will be here next time you sign in."; the local banner reuses that text. `[TEARDOWN]` `[CODE]`
- How the real app stores or issues keys: `[UNKNOWN]`.

### 7. Run and Cancel
- Run is enabled when: endpoint selected, key present (if needed), all required fields filled, no validation error, nothing already running. `[CODE]`
- Click or Ctrl/Cmd+Enter: builds `{endpointId, values, apiKey}`, POSTs `/api/playground/run`, sets running, clears the previous result, switches to the Output tab, and announces "Running request". `[CODE]` `[SEEN]`
- While running: the Run button becomes **Cancel** with a live timer (50 ms ticks, seconds with 2 decimals); the output area shows "Running…", the timer, a second Cancel button and a skeleton shaped like result rows. `[SEEN]` `[CODE]`
- The mock route waits 350 to 800 ms before replying, so these states are visible. `[CODE]`
- Cancel aborts the fetch, ignores any late response, returns the output to "No response yet", announces "Request cancelled" and adds nothing to Recent runs. `[SEEN]` (QA: cancel; cancel then immediate re-run ends with "Results (3)", not running, one history entry) `[CODE]` (run sequence guard)
- Also cancelling on: endpoint change, reload of a recent run, page leave. `[CODE]`
- Completion: shows the result, status chip, client-measured duration, announces "Request finished with status N" and prepends a Recent run. A network failure produces a synthetic status-0 error envelope ("Network error: could not reach the local mock server."). `[CODE]` (the failure path was not triggered in this audit)
- Because validation and the key gate run client-side, 401 and 422 envelopes cannot be produced by the normal UI; they appear only through direct HTTP calls. `[WORKED-OUT]`
- Rate limiting, retries, polling and streaming: none implemented. `[CODE]` The live product showed none either. `[TEARDOWN]`

### 8. Recent runs
- Appears after the first completed run (hidden when empty). Newest first, capped at 10, stored in `sessionStorage` (`lb_pg_recent`) so it survives reload within the tab and is cleared with the tab. `[CODE]` `[SEEN]`
- Row: endpoint name, status chip, duration, clock time (24 h, hours:minutes). The card says "Kept in this tab only. Selecting a run reloads its request without sending it." `[SEEN]`
- Selecting a row restores the endpoint, form values and stored result, switches to the Output tab, cancels any running request, sends **no** network request, and toasts "Loaded a previous run. Nothing was sent." The list length is unchanged. `[SEEN]` (QA reload check) `[CODE]`
- Clear empties the list and storage. `[CODE]`
- Stored results include the full body (up to about 12 KB for Pricing x 10 runs). `[CODE]`
- Not recorded: cancelled runs. Runs are recorded even when the envelope is an error. `[CODE]`
- The API key is never stored in a history entry. `[CODE]`

### 9. Output and code
**Output tab**
- Empty state: icon, "No response yet", "Run a request to see the result here, formatted or as raw JSON." `[SEEN]`
- Header: "Results (N)" where N is the length of the first array found in the body (`costs`, `results`, `items`, `sections`, `boards`, `resolved`, `divisions`), otherwise "Response"; in JSON view the heading is "Response body". Status chip (green 2xx, red otherwise), duration with 3 decimals, copy-response button (check mark for 1.5 s, toast "Response copied"). `[CODE]` `[SEEN]`
- **Visual** renderers: Pricing (price-per-credit line plus rows with description, category badge, `endpoint · operation`, credit pill, `$/call`); array-of-objects bodies as cards (citation or title, tags from corpusType/state/actStatus/goodLawStatus, excerpt, actId); error envelopes as a red alert ("Error 401 …"); any other object as a key/value list (underscore keys hidden), with nested values pretty-printed. `[CODE]` `[SEEN]`
- **JSON**: pretty-printed body only (not the envelope), scrollable to 560 px height, focusable. `[CODE]`
- Dev-only note under the output says whether the body is the confirmed Pricing shape or an invented one (hidden in release). `[CODE]`

**Code tab** (cURL | Python | JavaScript, selection persists across endpoints)
- Header: uppercase language label (`CURL`, `PYTHON`, `JAVASCRIPT`) and a copy button (check mark, toast "Code copied"). `[SEEN]` `[CODE]`
- Host `https://api.vaquill.ai` + `/api/v1/...`; path params substituted when filled; GET query params appended to the URL (cURL, JavaScript) or put in `params` (Python); only filled values are included; header `Authorization: Bearer $VAQUILL_API_KEY` (or `os.environ['VAQUILL_API_KEY']` / `process.env.VAQUILL_API_KEY`) is always present, even for Pricing. `[CODE]`
- Exact formats (verified by QA text checks for POST Search): cURL `curl -X POST '<url>' \` + `-H "Authorization…" \` + `-H "Content-Type: application/json" \` + `-d '<2-space JSON>'`; Python `import os, requests` … `payload = { … }` with 4-space indent and trailing commas, `requests.post(url, headers=headers, json=payload)`, `raise_for_status()`, `print(r.json())`; JavaScript `const res = await fetch("<url>", {` with `method: "POST"` **without a trailing comma** (reproduced live bug), headers block, `body: JSON.stringify(…)`, then `if (!res.ok) throw …` and `console.log(await res.json());`. GET JavaScript keeps its comma. `[SEEN]` `[CODE]` `[TEARDOWN]`
- JavaScript only: line-number gutter and highlighted `VAQUILL_API_KEY` (matches the one live view captured). cURL and Python have neither (cURL matches the live view; Python is a guess). `[CODE]` `[TEARDOWN]`
- Non-GET verbs other than POST are formatted like POST (including the missing comma). Nothing runs these (PATCH/DELETE endpoints are not runnable). `[WORKED-OUT]`
- Snippets reflect the form live; switching to Code while running shows the code (the Run button still shows Cancel). `[CODE]`

### 10. Mocked behavior currently supported
**Routes**
- `GET /api/playground/spec?jurisdiction=US`: 200, 33 endpoints; `IN` (or any other value) returns `{"endpoints": []}`; headers `x-brand: vaquill`, `x-robots-tag: noindex, nofollow, noarchive, nosnippet`. `[SEEN]` `[CODE]`
- `POST /api/playground/run`: always HTTP 200 with `{status, ok, body, meta}`; delay 350 to 800 ms; malformed or empty JSON is treated as `{}` and yields a 404 envelope; `GET` on it returns 405. `[SEEN]` `[CODE]`
- Envelope meta: `elapsedMs` (measured only on success), `requestId` (`mock-…` on success, `null` on errors), `rateLimit` (60 / 59 / now+60 s for key-requiring endpoints, nulls for Pricing), `url` (real-looking `https://api.vaquill.ai/...` path with params substituted), `method`. `[CODE]` `[SEEN]`
- Error bodies: missing key 401 `"An API key is required for this endpoint."` (confirmed text); unknown or non-runnable endpoint 404 `"Unknown or non-runnable endpoint."`; missing required fields 422 `"Missing required field(s): …"` (invented wording). Order of checks: endpoint exists, key, required fields. `[CODE]` `[SEEN]`
- No upstream call is ever made. Every success body except Pricing carries `_mock: true` and a `_note`. `[CODE]` `[SEEN]`

**Per endpoint** (probed live; 401/422 columns are what a direct HTTP call returned without a key / with a key but no values; "Credits" is the pricing-table cost):

| Group | Name | Method and path | Fields (kinds) | Required | Key needed | Credits | No key / missing required | Mock body keys |
|---|---|---|---|---|---|---|---|---|
| Pricing / - | Pricing | `GET /api-credits/pricing` | 1 (1 enum) | - | no | - | 200 / - | dollarPerCredit, minCredits, maxCredits, costs |
| US Statutes / Search | Search statutes | `POST /us/statutes/search` | 24 (1 textarea, 7 enum, 5 text, 6 number, 2 boolean, 3 date) | query | yes | 4 | 401 / 422 | query, total, limit, offset, hasMore, creditsConsumed, results |
| US Statutes / Search | Count a scope | `POST /us/statutes/count` | 9 (3 enum, 4 text, 1 number, 1 boolean) | - | yes | 1 | 401 / - | count, creditsConsumed |
| US Statutes / Section Lookup | Section metadata | `GET /us/statutes/section/{act_id}` | 1 (1 text) | act_id | yes | 2 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Section full text | `GET /us/statutes/section/{act_id}/body` | 4 (1 text, 1 enum, 1 boolean, 1 date) | act_id | yes | 6 | 401 / 422 | actId, citation, text, html, creditsConsumed |
| US Statutes / Section Lookup | Neighbouring sections | `GET /us/statutes/section/{act_id}/related` | 2 (1 text, 1 number) | act_id | yes | 2 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Section change history | `GET /us/statutes/section/{act_id}/changes` | 6 (1 text, 3 number, 2 enum) | act_id | yes | 1 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Cited by | `GET /us/statutes/section/{act_id}/cited-by` | 2 (1 text, 1 number) | act_id | yes | 2 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Defined terms | `GET /us/statutes/section/{act_id}/definitions` | 1 (1 text) | act_id | yes | 4 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Cross-state comparison | `GET /us/statutes/section/{act_id}/cross-state` | 2 (1 text, 1 number) | act_id | yes | 6 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Enacting laws | `GET /us/statutes/section/{act_id}/enactments` | 1 (1 text) | act_id | yes | 1 | 401 / 422 | actId, citation, title, corpusType, state, actStatus, goodLawStatus, sourceUrl, excerpt, hierarchy, lastUpdated, creditsConsumed |
| US Statutes / Section Lookup | Batch section metadata | `POST /us/statutes/sections` | 2 (1 array, 1 boolean) | actIds | yes | 2 | 401 / 422 | sections, creditsConsumed |
| US Statutes / Citations | Resolve a citation | `GET /us/statutes/resolve` | 3 (1 text, 2 enum) | cite | yes | 2 | 401 / 422 | resolved, unresolved, creditsConsumed |
| US Statutes / Citations | Resolve citations (batch) | `POST /us/statutes/resolve` | 3 (1 array, 2 enum) | citations | yes | 2 | 401 / 422 | resolved, unresolved, creditsConsumed |
| US Statutes / Citations | Extract citations | `POST /us/statutes/extract-citations` | 4 (1 textarea, 1 enum, 2 boolean) | text | yes | 2 | 401 / 422 | resolved, unresolved, creditsConsumed |
| US Statutes / Browse | Coverage | `GET /us/statutes/coverage` | 1 (1 enum) | - | yes | 0 | 401 / - | jurisdictions, corpora, totalSections |
| US Statutes / Browse | Browse divisions | `GET /us/statutes/divisions` | 10 (3 enum, 1 number, 5 text, 1 boolean) | corpusType | yes | 1 | 401 / 422 | divisions, hasMore, creditsConsumed |
| US Session Laws / Browse | List session laws | `GET /us/session-laws/list` | 16 (5 enum, 2 text, 5 date, 2 boolean, 1 textarea, 1 number) | jurisdiction | yes | 1 | 401 / 422 | items, hasMore |
| US Session Laws / Search | Search session laws | `POST /us/session-laws/search` | 9 (1 textarea, 3 enum, 1 text, 2 date, 2 number) | query | yes | 4 | 401 / 422 | items, hasMore |
| US Session Laws / Lookup | Session law | `GET /us/session-laws/{session_law_id}` | 2 (1 textarea, 1 enum) | session_law_id | yes | 2 | 401 / 422 | items, hasMore |
| US Session Laws / Lookup | Session law text | `GET /us/session-laws/{session_law_id}/body` | 4 (2 textarea, 1 number, 1 text) | session_law_id | yes | 6 | 401 / 422 | items, hasMore |
| US Session Laws / Lookup | Batch session laws | `POST /us/session-laws/batch` | 3 (1 array, 1 enum, 1 boolean) | ids | yes | 2 | 401 / 422 | items, hasMore |
| US Session Laws / Lookup | Session law changes | `GET /us/session-laws/changes` | 3 (2 number, 1 enum) | - | yes | 1 | 401 / - | items, hasMore |
| Board Watches / - | List boards | `GET /boards` | 4 (1 text, 1 enum, 2 number) | - | yes | 0 | 401 / - | boards, total |
| Board Watches (not in picker) | List watches | `GET /watches` | 2 | - | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Create watch | `POST /watches` | 8 | corpusType | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Update watch | `PATCH /watches/{watch_id}` | 7 | watch_id | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Delete watch | `DELETE /watches/{watch_id}` | 1 | watch_id | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Watch changes | `GET /watches/{watch_id}/changes` | 7 | watch_id | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Change diff | `GET /watches/{watch_id}/changes/{change_id}/diff` | 2 | watch_id, change_id | n/a | 4 | 404 (not runnable) | - |
| Board Watches (not in picker) | Watch deliveries | `GET /watches/{watch_id}/deliveries` | 2 | watch_id | n/a | 0 | 404 (not runnable) | - |
| Board Watches (not in picker) | Send test delivery | `POST /watches/{watch_id}/test` | 1 | watch_id | n/a | 0 | 404 (not runnable) | - |
| Credits / - | Credit balance | `GET /credits/balance` | 0 (none) | - | yes | 0 | 401 / - | balance, plan |

- Shape sharing (worked out from the table): `section/related`, `/changes`, `/cited-by`, `/definitions`, `/cross-state`, `/enactments` all return the section-metadata shape; all six `session-laws` endpoints return the same `items` list; `resolve` (GET and POST) and `extract-citations` return the same `resolved`/`unresolved` shape. `[WORKED-OUT]`
- Search honours `limit` (up to the 3 canned hits) and echoes `query` and `offset`; it ignores every filter. Count always returns 60494. Coverage returns fixed totals. Balance is a fixed 1,000. `[CODE]`
- Pricing: 31 rows and the envelope are the confirmed shape; descriptions after the first row are invented paraphrases. `[TEARDOWN]` `[CODE]`

### 11. Persistence, URL and state
- URL: `?tab=<id>` selects the console tab; `?endpoint=<id>` preselects an endpoint (read once). Endpoint, values, result and Output/Code choices do not write to the URL. `[CODE]`
- localStorage: `lb_playground_mock_key`. sessionStorage: `lb_pg_recent`. In-memory only: per-endpoint form values, current result, Code language, Visual/JSON view. A reload loses form values and the visible result but keeps Recent runs. `[CODE]` `[SEEN]`
- Storage access is wrapped in try/catch; blocked storage degrades to in-memory only. `[CODE]`

### 12. Responsive behaviour and accessibility
- Verified clean at 360, 390, 820 and 1280 px: no horizontal overflow, no off-screen elements, no tap targets under 24 px, picker panel inside the viewport, drawer open/close/focus/Escape, no console or network errors. `[SEEN]`
- Below 768 px the sidebar becomes a drawer; the header wraps; the picker panel is `min(32rem, 92vw)`. `[CODE]` `[SEEN]`
- Tabs implement arrow-key navigation; selects follow the listbox pattern; the output region is not a live region (a hidden status line announces run states); icon buttons have labels. `[CODE]` `[SEEN]` (QA checks arrow navigation)
- Lenis smooth scroll is site-wide; the picker list, enum legends, code/JSON blocks and drawer opt out with `data-lenis-prevent`. `[CODE]`
- Real mobile or tablet behaviour of the live product: `[UNKNOWN]`.
- No screen-reader testing, colour-contrast measurement or reduced-motion run was done in this audit. `[UNKNOWN]`

### 13. Differences from the real Vaquill Playground (from the teardown)
| Area | Real (teardown) | Local |
|---|---|---|
| Backend | Server-side proxy to `https://api.vaquill.ai/api/v1/...` | Local mock, no network beyond localhost `[TEARDOWN]` `[CODE]` |
| Spec | 33 endpoints, long live descriptions, more field attributes | Same ids/paths/fields; paraphrased descriptions; `minLength`/`minItems`/`maxItems` unused `[TEARDOWN]` `[CODE]` |
| Response bodies | Real data | Only Pricing is the confirmed shape; rest invented `[TEARDOWN]` `[CODE]` |
| API key | Real keys, key page, credits | Random string in localStorage; fixed 1,000 credits `[TEARDOWN]` `[CODE]` |
| Enums | Multi-value and list inputs for corpus/state/etc.; `federal` accepted for `state` | Single-select only; `federal` is described in text but is not an option `[TEARDOWN]` `[CODE]` |
| Picker | 25 options, real sub-headings and names | 25 options; sub-headings and 19 of 25 names invented (six names are quoted in the teardown) `[TEARDOWN]` `[CODE]` |
| Run timing | Real latency (about 0.3 to 0.85 s seen) | 350 to 800 ms artificial `[TEARDOWN]` `[CODE]` |
| Recent runs | "Kept in this tab only"; cap unknown | Cap of 10 invented; sessionStorage `[TEARDOWN]` `[CODE]` |
| Code tab | Seen for POST search (all 3), GET pricing (JS) | Same text for those; everything else extrapolated `[TEARDOWN]` `[CODE]` |
| Help tour | Button exists; tour did not open | Invented 4-step tour `[TEARDOWN]` `[CODE]` |
| Copy link | Payload unknown | Endpoint id only `[TEARDOWN]` `[CODE]` |
| Shell | Real icons, logo, sidebar width, product switcher and jurisdiction menu | Approximations; switcher and flag are static `[TEARDOWN]` `[CODE]` |
| Learn links | External | Local pages `[CODE]` |
| Other console tabs | Full screens | Overview and API Keys minimal; 5 tabs placeholder or dead `[CODE]` |
| Privacy notice | Present | Text copied; link goes to local `/security` `[TEARDOWN]` `[CODE]` |
| Brand | Vaquill | Vaquill name and typeset wordmark with a hand-drawn leaf (not the real logo) `[CODE]` |

### 14. Known gaps and unverified behaviour
1. Real response shapes for search, section, session-law, board and resolve endpoints. `[UNKNOWN]`
2. Real 401/402/422/429 bodies and rate-limit header values. `[UNKNOWN]`
3. What the live "Walk me through Playground" tour contains. `[UNKNOWN]`
4. What the live Copy link encodes (endpoint, values, both, neither). `[UNKNOWN]`
5. The live cancel mechanism (aborted request vs ignored result) and whether cancelled runs are logged. `[UNKNOWN]`
6. Live validation messages, and live behaviour for out-of-range numbers. `[UNKNOWN]`
7. How the live form enters multi-valued fields (`corpusType`, `state`, `actStatus`, `fields`, `source`). `[UNKNOWN]`
8. Whether the live Code tab highlights the key and numbers lines in cURL/Python; the live narrow-screen drawer behaviour and mobile layout. `[UNKNOWN]`
9. Exact paddings, shadows, radii, sidebar width, icons and the real logo. `[UNKNOWN]`
10. The live visual renderers for non-Pricing endpoints (cards vs tables) and long-text/error states. `[UNKNOWN]`
11. Which endpoints truly need a key (only Pricing and `credits/balance` are confirmed). `[TEARDOWN]` `[WORKED-OUT]`
12. Local limitations noticed in the audit: `state` lacks the `federal` token the description promises; mock filters do nothing; `?tab=settings` and four sidebar tabs go nowhere useful; the network-failure path was never triggered; screen-reader, contrast and reduced-motion behaviour were not tested. `[CODE]` `[UNKNOWN]`
13. Release builds hide all mock disclosures (see summary). `[CODE]` `[SEEN]`

### 15. Documentation and packaging state
- `lexbharat-docs.zip` (46,529 bytes, written 2026-10-20 01:03) holds 11 files: `README.md`, `docs/{ARCHITECTURE, ASSUMPTIONS-AND-UNKNOWNS, DATA-FLOW, PAGES-AND-DATA-MAP, PLAYGROUND-BUILD, PLAYGROUND-TEARDOWN, PUBLIC-EVIDENCE, SCREENSHOTS}.md`, `qa/QA-REPORT.md`, `qa/QA-LOG.md`. All 11 are byte-identical to the files on disk, so the zip is **current** and **includes the new Playground docs**. `[SEEN]`
- Not in the zip: this file (`playground-evidence.md`), `qa/playground-qa.mjs`, `qa/playground/report.json`, `qa/playground-prod/report.json`. `[SEEN]`
- Stale (the files exist and are in the zip, but they predate the console): `docs/ARCHITECTURE.md` (lists "6 routes" of mock API and 42 page files; no `/api/playground/*`, no `(console)` route group); `docs/DATA-FLOW.md` and `docs/PAGES-AND-DATA-MAP.md` (only the marketing `/playground`); `docs/SCREENSHOTS.md` (no console screenshots); `docs/ASSUMPTIONS-AND-UNKNOWNS.md` (no Playground clone entries); `qa/QA-REPORT.md` and README table row (582 routes, dev-server framing; the Playground QA is only in `docs/PLAYGROUND-BUILD.md`). The route count is now 666 static pages in the last production build. `[SEEN]`
- `README.md` links the Playground build doc and the QA command. `[SEEN]`
- `qa/playground/` holds 31 screenshots (11 MB) and `report.json`; `qa/playground-prod/` holds only `report.json`. `[SEEN]`
- Sensitivity: the zip includes `PLAYGROUND-TEARDOWN.md`, written from a logged-in Vaquill session. `[SEEN]`

### 16. Evidence log
- REA scenario: evidence `ev_292d206cca13859118d0ee5dc091bda43fab9b59b29d091c3c19ee7ea6fd8e65`, 10 steps completed, 0 console, 0 page errors. `[SEEN]`
- Endpoint probes: 33 spec endpoints exercised; 25 runnable returned 200 with a key, 401 without (Pricing 200 both ways), 422 on missing required fields where fields are required; 8 non-runnable returned 404 envelopes. `[SEEN]`
- QA script: 4 widths on dev and production, 0 problems. `[SEEN]`
- Files and line counts read: see section 2. `[CODE]`
