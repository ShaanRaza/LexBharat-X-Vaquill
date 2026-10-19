# Playground clone: what was built

Source of truth: `PLAYGROUND-TEARDOWN.md` (in the project, withheld from the zip; see BUNDLE-NOTES.md). This is an internal REA clone of the authenticated Vaquill developer console's Playground. It runs entirely locally against mocks. No live reconnaissance was done for this build, and nothing calls the real Vaquill API.

Open it at `http://localhost:3100/developer?tab=playground` (`npm run dev` or `npm run build && npm run start`). Pages outside the marketing site keep the Vaquill name on purpose here (the marketing pages are still LexBharat).

## 1. What was built

| Piece | File |
|---|---|
| Mock spec fixture (33 endpoints, 25 runnable; pricing table) | `src/data/playgroundSpec.ts` |
| Mock `GET /api/playground/spec?jurisdiction=US` | `src/app/api/playground/spec/route.ts` |
| Mock `POST /api/playground/run` (envelope, key gate, 401/422, delay) | `src/app/api/playground/run/route.ts`, `src/lib/playgroundMock.ts` |
| cURL / Python / JavaScript snippet generator (with the live missing-comma bug) | `src/lib/playgroundCode.ts` |
| Mock API key hook (localStorage) | `src/lib/useMockKey.ts` |
| Console shell (sidebar, top bar, mobile drawer) | `src/components/console/ConsoleShell.tsx` |
| Accessible grouped select | `src/components/console/Listbox.tsx` |
| Tab router + minimal Overview / API Keys screens | `src/components/console/DeveloperConsole.tsx` |
| The Playground itself | `src/components/console/PlaygroundApp.tsx` |
| Route | `src/app/(console)/developer/page.tsx` |
| Scoped tokens (`.console`), animations | `src/app/globals.css` |

Behavior: the picker is driven by the mocked spec and lists only runnable endpoints, grouped by tag with sub-headings. Forms are generated from each field's `kind` (enum, number with presets, boolean switch, date, text, one-per-line lists, described enum legends, "Show more" clamping). Endpoints that need a key show the "Create API key" banner and a disabled Run with the footer hint; Pricing runs without a key. Run posts `{endpointId, values, apiKey}` to the mock route and shows the Cancel button with a live timer and a skeleton, then "Results (N)" with a status chip, duration and copy. Output has Visual and JSON views; Code has cURL, Python and JavaScript. Recent runs (tab-scoped, `sessionStorage`) reload a prior request and its result without sending. ⌘/Ctrl+Enter runs. The console's own mock notices (banner, "Local mock" badge, "Mock key", "Mock" on responses, "(local mock)" in the tab title) are **always** shown, including in release builds; only extra provenance notes (for example "reproduced bug") are hidden by the release toggle (`NEXT_PUBLIC_RELEASE=1`). See section 5.

## 2. Confirmed vs mocked

**Reproduced from confirmed findings:** spec and run envelopes (including the exact 401 body and `meta` fields); endpoint ids, methods, paths, tags, `runnable` split, field names / `in` / `kind` / `required` / defaults; picker structure and the 25 options; key banner, disabled Run and footer text; running state; result header (`Results (N)`, status chip, duration, copy); Visual/JSON and Output/Code controls; Code snippets for POST search and GET pricing, including the missing comma after `method: "POST"` in JavaScript; Recent runs wording and behavior; privacy notice; the Pricing body (31 rows, credits, categories) and its visual layout; typography (Schibsted Grotesk, Source Code Pro), color tokens, radii.

**Mocked (written for this build, not captured):**
- All response bodies other than Pricing and the 401 (`playgroundMock.ts`; every body carries `_mock: true`).
- API key: a random string in `localStorage` (`lb_playground_mock_key`) that unlocks only the local mock route. Key-required flags other than Pricing and `credits/balance` are guesses.
- Field descriptions (paraphrased, shorter than the live text), picker display names beyond the five the teardown quoted, sub-group headings, enum lists the teardown did not list, example chips other than the first.
- Help tour (4 steps), Copy link encoding (`?tab=playground&endpoint=<id>` only), per-endpoint remembered form values, the 10-run history cap, rate-limit numbers in `meta`, the 422 message, Overview and API Keys screens, sidebar width and icons, the narrow-screen drawer, the logo (typeset text plus a hand-drawn leaf, not the real mark).

## 3. Gaps to verify later against the live product

1. Real response shapes for search, section, session-law and watch endpoints, and upstream 402/422/429 bodies and rate-limit header values (needs a key and credits).
2. The "Walk me through Playground" tour steps, and what Copy link actually encodes.
3. The visual renderers for non-Pricing endpoints (cards vs tables), and long-text/error states.
4. Mobile and tablet layouts (sidebar behavior below 768 px, picker width).
5. Exact paddings, card radius/shadow values, sidebar width, icon set, and the real logo.
6. Keyboard behavior (⌘↵ handler, picker type-ahead), focus order, and the Cancel mechanism.
7. How multi-valued fields (`corpusType`, `state`, `actStatus`) are entered in the live form (this build is single-select).
8. Per-field validation messages, and what "Show more" reveals for the long descriptions.

## 4. Polish and QA pass (second pass)

Everything below was verified locally only; no live reconnaissance was done and nothing real was touched (billing, credits and API-key infrastructure are untouched; the key is still a mock).

**Changed**
- **Cancel edge cases:** runs carry a sequence number, so a cancelled run can no longer finish after a newer run starts and flip the UI back to "not running" or write a stale result or history entry. Cancel, rapid cancel then re-run, switching endpoint mid-run, reloading a recent run mid-run, and leaving the page all abort cleanly. A cancelled run adds nothing to Recent runs.
- **Code tab:** the language label is uppercase (`CURL`, `PYTHON`, `JAVASCRIPT`); the JavaScript view has the line-number gutter and a highlighted `VAQUILL_API_KEY`, matching the one live view that was captured. The copy button shows a check mark for 1.5 s and the toast still fires. The snippet text is unchanged (still reproduces the missing comma after `method: "POST"`).
- **Tabs:** Output/Code, Visual/JSON and cURL/Python/JavaScript are now keyboard-operable tab lists (Arrow keys, Home, End, roving tabindex).
- **Validation (inferred):** number fields check `min`, `max` and whole-number rules, show an inline error and block Run with the footer hint.
- **Loading state:** the skeleton now mirrors the result rows (text lines plus credit pill) and staggers its pulse; `prefers-reduced-motion` turns the pulse off.
- **Screen-reader output:** the whole output panel is no longer an `aria-live` region; a hidden status line announces "Running request", "Request finished with status N", "Request cancelled" instead.
- **Narrow-screen drawer:** `role="dialog" aria-modal`, focus moves into it and returns to the menu button, Tab is trapped, Escape closes, page scroll is locked, it closes when the window grows past 768 px, and its width is `min(260px, 85vw)`.
- **Header:** wraps instead of overflowing at 360 px; "Copy link" no longer wraps; the "local clone" badge is hidden below 640 px; "Show more" targets are at least 24 px tall.
- **Smooth scroll:** the picker list, enum legends, code and JSON blocks and the drawer carry `data-lenis-prevent`, so wheel scrolling inside them is not hijacked by the site-wide Lenis.
- **QA script:** `qa/playground-qa.mjs` (Node built-ins, no installs) drives the real UI headlessly at 360, 390, 820 and 1280 px: drawer, picker (25 options), key gating, run, cancel, cancel-then-rerun race, code snippets (including the missing-comma check), arrow-key tabs, recent-run reload, number validation, horizontal overflow, small tap targets, console and network errors. Latest run: all four widths clean. Screenshots and `report.json` are in `qa/playground/`.

**Still inferred (mocked and labelled)**
Everything listed under "Mocked" in section 2, plus: the validation messages and when they fire, the gutter/highlight on cURL and Python (left off), the drawer's focus and scroll-lock behavior, the 640 px badge breakpoint, the skeleton shape, the announcer wording.

**Still needs live verification**
The eight gaps in section 3, plus: whether the live Code tab highlights the key in cURL/Python, how the live form reports an out-of-range number, the live narrow-screen drawer behavior, and the live cancel behavior (aborted fetch vs. ignored response).

## 5. Fix pass (2026-10-20)

Six follow-ups from `playground-evidence.md`, done in place. Verified with `node qa/playground-qa.mjs` (dev and production, four widths) and a production build.

1. **Mock state visible in production.** `ConsoleShell.tsx` shows an always-on banner ("Local mock of the Vaquill developer console · responses, API key and credits are simulated on this computer · not affiliated with Vaquill") and a "Local mock" badge in the top bar; `PlaygroundApp.tsx` shows a "Mock key" label in the key banner, a "Mock" pill on every response, and "(Local mock: requests never leave this computer.)" in the privacy notice; the page title is "Developer API & MCP Server | Vaquill (local mock)". None of these use `DevOnly`, so the release toggle no longer hides them.
2. **Dead links.** Every sidebar item is now a working destination or intentionally disabled. Live: Overview, Playground, API Keys. "Demo" bridges: Law Change Alerts and MCP Server open a small in-console page with a button to the local `/alerts` or `/mcp` demo. Disabled (greyed, `aria-disabled`, "Not in clone" chip, not links): Credits & Usage, Billing, Settings, deliberately, because this clone never touches credits, billing or settings; opening those URLs directly shows an explanation page with a way back. `?tab=settings` no longer silently falls back to Overview.
3. **`federal` in `state`.** `playgroundSpec.ts` exports `FEDERAL`, `STATE_FILTER_VALUES`, the `StateFilterValue` type and `isStateFilterValue`; `federal` is the first option of the `state` select on search (confirmed by the spec text), count, resolve (GET and POST), extract-citations, coverage and boards (inferred). Divisions and the session-laws `jurisdiction` fields still reject it. The mock validates enums case-insensitively (422 for unknown values such as `zz`), filters search by it (`federal` = federal corpora), sums federal counts, returns only the federal block from coverage, and lists federal boards. The generated code shows `"state": "federal"`.
4. **Endpoint-specific mock bodies.** `src/lib/playgroundFixtures.ts` (new) and a rewritten `src/lib/playgroundMock.ts` give each of the 24 non-Pricing endpoints its own response shape (the QA script asserts that no two share one): search (ranked, filtered, paged, `fields`, `includeBody`, cost), count, section metadata / body / related / changes / cited-by / definitions / cross-state / enactments, batch sections, resolve (GET/POST), extract-citations (regex over your text), coverage, divisions, session-law list / search / get / body (chunked, SHA check) / batch / changes, boards, credits balance. Unknown sections or laws return 404; a mismatched `expectTextSha256` returns 409; invalid enums, ranges and over-50 batches return 422. All of this is **inferred** (shapes and wording invented from endpoint names and spec text); only Pricing and the 401 are confirmed, and Pricing is left byte-for-byte unchanged (no `_mock` marker inside it).
5. **Bundle.** `lexbharat-docs.zip` rebuilt with the updated docs, both evidence files and the QA artifacts (see `docs/BUNDLE-NOTES.md` for the exact contents).
6. **Teardown material.** `docs/PLAYGROUND-TEARDOWN.md` is **withheld from the bundle** (still in the working tree). See `docs/BUNDLE-NOTES.md`.

**Newly inferred:** the sub-resource response shapes, which endpoints accept `federal`, the 404/409/422 wording, the "Demo" bridge pages, and the disabled-tab treatment.
**Still needs live verification:** everything in section 3, plus whether the live `state` field really accepts `federal` outside search, and the live response shape for every endpoint other than Pricing.

## 6. Release-readiness pass (2026-10-20)

Verdict: **ship with caveats** (details in `qa/QA-REPORT.md` Addendum 2 and `docs/BUNDLE-NOTES.md`). Production build clean (666 pages); Playground QA 0 problems at four widths; one accessibility regression found and fixed (map focus indicator). Accepted caveats: invented non-Pricing response shapes (labelled mock), `federal` beyond search is inferred, legal copy is placeholder, no cross-browser or screen-reader testing.
