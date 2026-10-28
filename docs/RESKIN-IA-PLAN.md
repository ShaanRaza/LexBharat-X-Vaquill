# Restructure plan: five areas, one top bar (Step 1 of the spec in `docs/RESKIN-SPEC.md`)

**Status: plan approved with the decisions below; Phases 1 and 2 done (Phase 2 waiting for your approval).** Written on the `reskin` branch. Nothing is pushed.

Scope you set: `reskin` branch only; no backend logic changes (search, Ask, Drafting, Review, Vault, limits, feedback); visual source is lexbharat.ai and the `mrharit/Lex-bharat` repo only; keep the testing banner, "not legal advice" notes, coverage warnings, the password gate and the Vault card buttons. Defaults applied to the spec's open questions: Desk stays minimal, light mode only, keep the "Was this right?" text, "Get started" on lexbharat.ai goes to the password page.

## Approved decisions (2026-10-28)

| # | Decision | Effect on the plan |
|---|---|---|
| 1 | Judgment URL is `/judgments/<court>/<year>/<case>` | Already in section 1 |
| 2 | Law page contents list section numbers only; broken chapter names are logged in `docs/DATA-GAPS.md` (section 2.5) | No Part or Chapter headings anywhere until the data is repaired |
| 3 | "Judgments citing this section" becomes a link to a judgment search for that section; no sample list in the real build | Law page margin (mock-up updated) |
| 4 | Add the small read-only route for Search "Your documents", reusing the Vault search code, by meaning and by exact words | New `app/api/vault/search/route.ts` in Phase 5. Query embeddings count against Voyage's 3 requests a minute |
| 5 | Only the open Search tab searches; counts on other tabs only where cheap (exact words); never sample numbers | Search mock-up updated |
| 6 | Desk box shows what Enter will do; defaults to Search when unsure | Desk mock-up updated; Phase 3 |
| 7 | `/privacy`, `/terms`, `/security` become public, with tests | Done in **Phase 7**, together with the rewritten text. They stay behind the password until then because the leftover text is placeholder |
| 8 | One plain dataset credit line for Vaquill AI (CC BY 4.0) | In every page footer (mock-ups updated; `PublicFrame` has it now) |
| 9 | Remove the copied marketing and extra legal pages; fold Cookies and data deletion into Privacy | Phase 1 removes the pages; Phase 7 writes the Cookies and deletion sections. **Feedback (answered 2026-10-28): a small in-app form (message + optional email), saved for /admin, no email sending.** Built in Phase 2 |
| 10 | Mock-up fixes (a) to (e) | (a) L-shaped corner marks, now also in the real `.marked` rule and `tokens.css`; (b) phone sheet opens only from a chip; (c) "138." at the top of the marked section; (d) **NI Act ss.143 and 145 are not missing**: already filled from the India Code PDF (`docs/MISSING-SECTIONS.md`); (e) the s.138 typos are in India Code's own PDF too, so no official text differs (`docs/DATA-GAPS.md` section 2.6) |

**Note on figures in the mock-ups:** the Law page shows "141 sections" and "3 possibly incomplete" from the raw text files. The running app counts differently (for the NI Act: 116 sections, 1 possibly incomplete, 40 filled in from India Code). The real build uses the app's counts.

## Phase 1 status (done, waiting for your approval)

Done on `reskin`, not pushed: the mock console, copied docs, mock account pages, 37 marketing pages, 9 mock and playground API routes and about 95 files of their data and components are deleted; the product switcher, country flag and "Data API" link are out of the shell; every old address redirects (`src/config/redirects.mjs`, tested). Two things found on the way and fixed:

1. **A palette from another product's console was overriding the LexBharat tokens** for the whole signed-in frame (`.console` in `globals.css`, "captured from the live console's computed styles"). It is removed, so the app now uses the real tokens (and the old light-emerald success colour that failed contrast is gone).
2. **The leftover placeholder Privacy, Terms and Security pages said "We do not train AI models on your data" and "nothing is stored"**, which is not true while Gemini and Voyage run on free plans and chats, drafts and documents are stored. Those three sections now say what actually happens. The pages are still behind the password.

## Phase 2 status (done, waiting for your approval)

**Built:** the pilcrow logo (`src/lib/brand.ts`, generated from the design repo's geometry; `components/kit/Logo.tsx`) and a tab icon (`src/app/icon.svg`, generated from the token colours); the slim top bar (logo, Desk · Ask · Search · Library · Work, Quick-find, menu), the phone bottom tab bar (hides while scrolling down a law or judgment, returns on scroll up), Quick-find (⌘K / Ctrl+K; laws by exact words, Supreme Court cases by party name or citation, your chats, drafts, reviews and documents; Enter opens the first result; never uses the Voyage limit), the testing banner under the bar, a `Tabs` component and Work's tabs, the Feedback form, `src/lib/routes.mjs` (every address in one place). The old sidebar, `ConsoleShell`, `BrowseShell` and `WorkspaceNav` are deleted. New tokens (`--h-topbar`, `--h-tabbar`, `--w-app`, `--w-quickfind`, `--w-dialog`, `--pad-page`, `--logo-h*`) are in `tokens.css`.

**Where each area points until its own page exists (pages keep their old addresses; Phases 3 to 6 change these in `src/lib/shell/areas.mjs`):** Desk `/workspace` (the old dashboard) · Ask `/workspace/chat` · Search `/workspace/browse?tab=acts` (the Acts search box) · Library `/workspace/browse` · Work `/workspace/drafting` with Drafts · Reviews · Documents tabs.

**Feedback.** A message and an optional email are saved to a new table, `public.feedback_messages`, and listed in `/admin/insights` under "Messages from the Feedback form". It is a new table in the same Supabase project, not a change to `public.feedback`: that table's checks and unique key assume one thumbs vote on one chat answer, draft or review, and the stats count it. At most 5 messages an hour per browser; the browser is stored as a hash; no IP address; no email is sent. **To switch it on, run `scripts/w8/w8b-feedback-messages.sql` once in the Supabase SQL editor.** Until then the form says so in plain words.

**Departures from the spec (all four approved 2026-10-28):**
1. **Phone menu.** The spec's phone top bar has only the logo and a search icon, which leaves Log out and Feedback unreachable on a phone. I added the same small menu button next to the search icon.
2. **Work tabs sit above each page's own title** in Phase 2, because each page still draws its own heading. Phase 6 puts them under the title.
3. **Search and Library both lead to the Acts and judgments browser** until Phase 5 gives Search its own page. Search is highlighted when you are on the Acts search tab; Library on everything else in the browser.
4. **The testing banner is now one line under the top bar on every page.** The repeated "Testing phase" sentences inside pages were removed; the feature-specific warnings stay (drafts and reviews are for a lawyer to confirm, Vault is saved on this browser only).
5. **Tab icon is an SVG only** (it scales to 32 and 16 px); extra PNG files would have needed more paths opened in the password gate. **Phase 8 adds a PNG apple-touch-icon** so iPhones show the logo on the home screen (it will need its path opened in the password gate, with a test).

**Addendum (after the first live try):** Search now has its own interim address, `/workspace/search`, so the top bar tells Search from Library by the path alone and is in the page from the first byte on every page. Phase 5 replaces it with `/search` and redirects the old address. A real feedback save was tested end to end on the local build (saved, shown in `/admin/insights`, test row deleted).

**Checks run:** `test:extract` 212 pass; `qa:sweep`; `build`; **axe-core** (WCAG 2 A and AA plus best practice) on 7 pages and on Quick-find, the menu and the Feedback form open, at desktop and phone width: no violations after two fixes (the banner and the dataset credit are now landmarks); no horizontal scroll at 375 px on any page; keyboard: Ctrl+K opens Quick-find with focus in the box, Escape closes it and returns focus. `ChatHistory` and `DraftHistory` are unused until Desk and Work reuse them.

## 0. What is in this step

| Item | Where |
|---|---|
| This plan (routes, files, components, phases, conflicts) | `docs/RESKIN-IA-PLAN.md` |
| 8 static mock-ups, each one responsive HTML page using the real tokens | `docs/mockups/{desk,ask,search,library,law,judgment,work,access}.html` |
| 16 screenshots (desktop 1280 px, phone 375 px) | `docs/mockups/<screen>-desktop.png`, `<screen>-phone.png` |
| Mock-up stylesheet (imports `src/styles/tokens.css`; no hard-coded colours) | `docs/mockups/mock.css` |
| Real excerpts the mock-ups use | `docs/mockups/sample-data.json` |
| Tools that build the mock-ups and the screenshots, and the reachability check | `scripts/reskin/make-mockups.mjs`, `make-mock-logos.mjs`, `shots.mjs`, `reach.mjs` |

**What is real in the mock-ups:** the Section 138 Negotiable Instruments Act text and the neighbouring section headings, the Act list with section counts and "possibly incomplete" counts, and the Supreme Court record 2014_INSC_514 with its opening text (open-india-law, CC BY 4.0). **Everything else is sample copy** (the Ask answer text, search counts, recent work, document names). The Ask answer only states things the dataset text supports (30 days' notice, 15 days to pay, section 142(2) on where to file; all checked against the dataset). The logo is the pilcrow with trace line (direction 1a), built from the geometry in the design repo's `lib/brand.ts`.

**Two things the mock-ups show that the current data cannot yet back** (see section 6, items 4 and 6): "Judgments that cite this section" on the Law page, and the tab counts on Search.

## 1. Every current route and its new home

### 1.1 Pages under `(console)` (the workspace)

| Current route | New home | Notes |
|---|---|---|
| `/workspace` (dashboard of cards) | `/` (Desk) | Dashboard cards go; Desk is the new home page |
| `/workspace/chat`, `/workspace/chat/<id>` | `/ask`, `/ask/<id>` | Same component `ChatApp`; the page becomes the reading desk |
| `/workspace/browse` | `/library` | Tabs: Acts, Constitution, Regulators, Judgments |
| `/workspace/browse/acts/<act>?section=<s>` | `/law/<act>/<s>` | `/law/<act>` with no section opens the first section. Orders/Rules and Schedules use their unit key as `<s>` |
| `/workspace/browse/judgments/<court>` | `/library/judgments/<court>` | Year list and case list |
| `/workspace/browse/judgments/<court>/<year>/<case>` | `/judgments/<court>/<year>/<case>` | **Keeps the year** (spec says `/judgments/<court>/<case>`; see section 6, item 1). High Court links keep `?p=<page>` |
| `/workspace/drafting`, `/workspace/drafting/<id>` | `/work/drafts`, `/work/drafts/<id>` | |
| `/workspace/review`, `/workspace/review/<id>` | `/work/reviews`, `/work/reviews/<id>` | Review keeps `?doc=<id>` (the Vault "Review" button) |
| `/workspace/vault`, `/workspace/vault/<id>` | `/work/documents`, `/work/documents/<id>` | `<id>` is the Preview page. Spec only lists the list page; the Preview page needs a home too |
| `/workspace/chat?doc=<id>` (the Vault "Ask about this" button) | `/ask?doc=<id>` | |
| `/developer`, `/developer?tab=*` | `/` (Desk) | Mock Developer console removed |

### 1.2 Other routes

| Current route | New home | Notes |
|---|---|---|
| `/` (the copied marketing home, `(site)/page.tsx`) | `/` is now Desk | The old home is removed; lexbharat.ai is the marketing site |
| `/access` | `/access` | Restyled (forest background, white card, pilcrow logo). Stays public |
| `/admin/insights` | `/admin` | Own password, plain layout. `/admin/insights` redirects |
| `/docs`, `/docs/*`, `/docs/llms.txt` | `/` (Desk) | Copied docs removed. `llms.txt` is removed too (it described the mock API) |
| `/auth/login`, `/auth/signup`, `/auth/forgot-password` | `/access` | Mock account pages; the app has one shared password, not accounts |
| `/favicon.ico` | unchanged | Redirects to the icon. Phase 2 adds the pilcrow icon (32 and 16 px) |
| `/privacy`, `/terms`, `/security` (+ `/security/vulnerability-disclosure`) | `/privacy`, `/terms`, `/security` | Public (no password), minimal public layout, rewritten truthfully in Phase 7. `vulnerability-disclosure` is folded into `/security` |
| `/dpa`, `/sla`, `/cookies`, `/refund-policy`, `/delete-data`, `/accessibility` | `/privacy` or `/` | SaaS-contract pages copied from the earlier build. Cookies and data deletion become sections of Privacy; the rest are removed (section 6, item 9) |
| All other marketing pages (below) | `/` (Desk) | Removed. Listed in 1.3 |

### 1.3 Marketing pages to remove (all in `(site)`, 37 pages)

`about`, `affiliates`, `alerts`, `blog` (+ `[slug]`), `brand`, `claude-plugin`, `clauses` (+ `[slug]`), `contact`, `customer` (+ `[slug]`), `engineering` (+ `[slug]`), `for-lawyers` (+ `ethics`), `in`, `legal-aid`, `legal-api`, `mcp`, `open-us-law`, `partners`, `playbooks` (+ `[slug]`), `playground`, `slack`, `support`, `topics` (+ `[slug]`), `use-case/legal-tech-developers`, `white-label`, `word` (+ `sideload`). The spec does not list these individually; it says the marketing site is lexbharat.ai and that Vaquill-derived wording goes. They are all copies of the earlier recreation. They redirect to `/` so no old link 404s.

### 1.4 API routes

`/api/*` is **unchanged** (chat, acts, judgments, drafting, review, vault, feedback, usage, access, admin) except: `/api/mock/*` (7 routes) and `/api/playground/*` (2) are removed with the mock console. One new read-only route is proposed (section 6, item 3).

### 1.5 New route tree

```
/                      Desk                        /library                 Library (tabs)
/ask, /ask/<id>        Ask                         /library/judgments/<court>
/search?q=             Search (tabs, filters)      /law/<act>[/<section>]   Law page
/work/drafts[/<id>]    Drafts                      /judgments/<court>/<year>/<case>
/work/reviews[/<id>]   Reviews                     /privacy /terms /security   public
/work/documents[/<id>] Documents (Vault)           /access                  password page
/admin                 Insights                    /api/*                   unchanged
```

### 1.6 Redirects

All old addresses go in `next.config.mjs` `redirects()` (permanent, with the query kept). They run before the password check, so an old bookmark first lands on the new address and then, if signed out, on the password page with `?next=` set to the new address.

| Source | Destination |
|---|---|
| `/workspace` | `/` |
| `/workspace/chat`, `/workspace/chat/:id` | `/ask`, `/ask/:id` |
| `/workspace/browse` | `/library` |
| `/workspace/browse/acts/:act` with `?section=:s` | `/law/:act/:s` |
| `/workspace/browse/acts/:act` | `/law/:act` |
| `/workspace/browse/judgments/:court` | `/library/judgments/:court` |
| `/workspace/browse/judgments/:court/:year/:case` | `/judgments/:court/:year/:case` |
| `/workspace/drafting`, `/workspace/drafting/:id` | `/work/drafts`, `/work/drafts/:id` |
| `/workspace/review`, `/workspace/review/:id` | `/work/reviews`, `/work/reviews/:id` |
| `/workspace/vault`, `/workspace/vault/:id` | `/work/documents`, `/work/documents/:id` |
| `/admin/insights` | `/admin` |
| `/developer`, `/docs`, `/docs/:path*`, `/auth/:path*`, every page in 1.3 | `/` (`/auth/*` goes to `/access`) |

## 2. Files to remove, add and change

Computed with `scripts/reskin/reach.mjs` (follows every import from the pages that stay). Of 520 files under `src/`, **95 are removable now**; a few more (the `(site)` layout, `Nav`, `DevOnly`, `LegalView`, `data/legal.ts`) go when Privacy, Terms and Security are re-homed in Phase 7. Files that look unused but are not (loaded by path, not import): the 77 judgment data files, `data/acts/*.json`, the Noto fonts for exports, the `*.test.mjs` files, `app/icon.svg`, `app/error.tsx`.

### 2.1 Remove (Phase 1 unless noted)

| Group | Files |
|---|---|
| Routes: `(auth)` | 3 pages + `layout.tsx` |
| Routes: `(docs)` | 4 files (`/docs`, `[...slug]`, layout, `llms.txt`) |
| Routes: `(console)/developer` | 2 files (page, layout). `(console)/layout.tsx` goes in Phase 2 |
| Routes: `(site)` marketing | 37 pages + `(site)/page.tsx` (old home). `(site)/layout.tsx` goes in Phase 7 |
| API | `api/mock/*` (7), `api/playground/*` (2) |
| Components | `AccessAndDemo`, `AlertsClient`, `CoverageMap`, `DocsShell`, `Hero`, `HomeClosing`, `Hub`, `HubList`, `McpSetup`, `PlaygroundClient`, `PricingFaq`, `Proof`, `Reveal`, `SiteFooter`; `console/DeveloperConsole`, `console/Listbox`, `console/PlaygroundApp`; `docs/*` (5) |
| Data | `company`, `corpus`, `docs/nav`, `docs/pages`, `endpoints`, `hubs`, `hubs.generated`, `india`, `jurisdictions`, `mcpTools`, `playgroundSpec`, `stateBreakdown`, `usMapPaths` |
| Lib | `mockStore`, `playgroundCode`, `playgroundFixtures`, `playgroundMock`, `useMockKey` (+ `mockSession` in Phase 2) |
| Phase 2 | `console/ConsoleShell`, `console/TopBar`, `console/BrowseShell`, `workspace/WorkspaceNav`, `workspace/WorkspaceDashboard` (replaced by the new shell and Desk) |

The full file list is in the appendix (section 8).

### 2.2 Add

| New file (proposed) | Purpose |
|---|---|
| `src/lib/routes.ts` | One place that builds every address (`lawHref`, `judgmentHref`, `askHref`, `docHref`...). The UI and the link builders in `lib/` use it, so a future URL change is one file |
| `src/lib/brand.ts` + `components/kit/Logo.tsx` (rewrite) | Pilcrow mark and lockup paths (from the design repo's geometry), one colour via `currentColor` |
| `public/icons` (32, 16 px favicon, `app/icon.svg`) | Pilcrow favicons |
| `components/shell/AppShell.tsx`, `TopBar.tsx`, `TabBar.tsx`, `QuickFind.tsx`, `MenuPopover.tsx` | New navigation (desktop top bar, phone tab bar, ⌘K) |
| `lib/quickfind.mjs` (+ test) | Pure logic: classify what was typed (citation, case name, question, other) and rank results. No styling |
| `components/desk/DeskBox.tsx`, `RecentWork.tsx`, `app/page.tsx` | Desk |
| `app/(app)/ask/...`, `components/ask/ReadingDesk.tsx`, `CitedPage.tsx`, `SourcesList.tsx` | Ask reading desk (wraps today's `ChatApp` logic) |
| `app/(app)/search/page.tsx`, `components/search/*` | Search page (tabs, filters, sheet) built from the existing search components |
| `app/(app)/library/...`, `components/library/*` | Library tabs, built from `BrowseLaws`, `CaseList` |
| `app/(app)/law/[actId]/[[...section]]/page.tsx`, `components/law/BookLayout.tsx` | Law page (contents, text, margin notes) |
| `app/(app)/judgments/[court]/[year]/[caseId]/page.tsx`, `components/judgment/*` | Judgment page (header, reader, margin) |
| `app/(app)/work/...`, `components/work/*` | Work tabs (Drafts, Reviews, Documents) |
| `app/(public)/privacy`, `terms`, `security` | Public pages with a minimal layout |
| `app/admin/page.tsx` | Insights at `/admin` |
| `components/kit/`: `Tabs`, `FilterSheet`, `MarginNotes`, `Label` (replaces `Badge` usage), `EmptyState`, `SegmentedToggle` | Shared parts (section 3) |
| `lib/vault/search.ts` + `app/api/vault/search/route.ts` | **Only if you approve section 6, item 3** |

### 2.3 Change (kept files; every change is presentation or a link)

- `src/styles/tokens.css`: add the proposed tokens (section 3.2); drop sidebar widths.
- `src/app/layout.tsx`: pilcrow icon, remove the demo banner; fonts stay.
- `src/middleware.ts` + `src/lib/access/token.mjs` (+ test): make `/privacy`, `/terms`, `/security` public (section 6, item 7).
- `next.config.mjs`: redirects (1.6); `outputFileTracingIncludes` paths if any route moves.
- The 25 workspace files that hold `/workspace/...` strings (`ActTextView`, `BrowseLaws`, `CaseList`, `CitedText`, `HcSearchResults`, `JudgmentTextSearch`, `ScSearchResults`, `SectionSearchResults`, `chat/*`, `drafting/*`, `review/*`, `vault/*`): links go through `routes.ts`.
- Link builders in `lib/` that print `/workspace/...` into results (`acts/jsonStore`, `acts/query`, `acts/repealed.mjs`, `judgments/jsonStore`, `hcSearch`, `hcData`, `statuteResolve`, `vault/links.mjs`) and their tests: strings only, no logic. Redirects keep old links working in the meantime.
- Scripts and README that name old routes: `scripts/judgments/qa-live.mjs`, `ui-shots.mjs`, `qa-search-smoke.mjs`, `scripts/w10/review-e2e.mjs`, `w10-check.mjs`, `scripts/w9/final-check.mjs`, `README.md`.
- `src/config/workspace.json`: hrefs (the Review feature flag stays).
- `DataAttribution.tsx`: restyle only. **The Vaquill AI dataset credit stays** (section 6, item 8).

## 3. Shared components and tokens

### 3.1 Components (one design each, reused everywhere)

| Component | Status | Used on |
|---|---|---|
| `AppShell` (top bar + banner + tab bar) | new | every app page |
| `TopBar` (logo, five areas, Quick-find, menu) | new (replaces `console/TopBar`) | desktop |
| `TabBar` (five icons, hides on scroll down on reading pages) | new | phone |
| `QuickFind` (⌘K / Ctrl+K, full screen on phone) | new | all |
| `DeskBox` (the big box) | new | Desk |
| `MarkedPage` / `MarkedScope` | exists; restyled to the spec | Ask, Law, Judgment, Review |
| `MarginNotes` | new | Law, Judgment, Ask |
| `CitationChip` (law, judgment, your document: three looks) | exists; extended | Ask, Search, Review, Law, Judgment |
| `Label` (Supported / Partly supported / Check sources / Not found, possibly incomplete, repealed, filled from India Code, read from scan) | new (wraps `Badge`) | everywhere |
| `Button`, `Toggle`, `fieldClass`, `Panel`, `Notice` | exist | everywhere |
| `Tabs`, `FilterSheet`, `EmptyState`, `SegmentedToggle` | new | Search, Library, Work |
| `FeedbackBar` ("Was this right?") | exists; moves to the margin | Ask |
| `Logo` (pilcrow lockup and mark) | rewrite | top bar, password page, footer |

### 3.2 Tokens to add to `src/styles/tokens.css` (all proposed in the mock-ups' `mock.css`, nothing hard-coded)

`--h-topbar: 56px`, `--h-tabbar: 62px`, `--w-app: 1200px`, `--w-toc: 15rem`, `--w-notes: 17rem`, `--w-read: 40rem`, `--w-ask-page: 27rem`, `--w-filters: 14rem`, `--pad-page: 1.5rem` (1rem on phone), `--text-greeting: 44px` (34px on phone). The existing tokens already cover the rest (paper, forest, ochre, red, radii 12 / 16 / pill, 17 px reading size, the glow colours). Remove `--w-sidebar*` and `--w-drawer` when the sidebar goes.

## 4. The 8 phases (from the spec), each stops for your screenshot approval

Every phase ends with the checks you set: backend diff empty (`git diff main -- src/lib/{acts,chat,drafting,judgments,review,vault,limits,insights} src/app/api` shows only link strings), `npm run test:extract`, `npm run qa:sweep`, `npm run build`, AA contrast, axe, 375 px, keyboard, and a pass of every feature that exists today. Nothing is pushed without asking.

1. **Remove.** Delete everything in 2.1 except the shell files; take the product switcher, flag and "Data API" link out of `ConsoleShell`/`TopBar`; add the redirects for the removed pages. The app still works with the old sidebar.
2. **New shell.** Pilcrow logo and favicons, `AppShell`, `TopBar`, `TabBar`, `QuickFind`, tokens. The old sidebar and `ConsoleShell` go. Pages stay at their old addresses for now.
3. **Desk and new addresses.** `routes.ts`, new route tree, all redirects in 1.6, Desk at `/`, link strings updated.
4. **Ask** as a reading desk (`/ask`, `/ask/<id>`): cited page on the right, bottom sheet on phone.
5. **Library, Law page, Judgment page**, plus **Search** (tabs, filters; "Your documents" only if item 3 is approved).
6. **Work**: Drafts, Reviews, Documents. The Vault card buttons (9806603) and the "Ready" hint come across unchanged.
7. **Public pages**: Privacy, Terms, Security written truthfully (testing phase, not legal advice, Neon / Supabase / Vercel / Gemini / Voyage, cookies, what is logged, that Gemini's free tier and Voyage may use submitted text), public without the password, linked from the footer and the password page.
8. **Final checks**, a PNG apple-touch-icon (opened in the password gate with a test), then merge into `main` (you push), then point app.lexbharat.ai back to Production.

## 5. Keep-as-is list (from your rules)

Testing banner (under the top bar), "not legal advice" notes, coverage and "possibly incomplete" warnings, quality labels, the password gate on the app, the Vault card buttons and "Ready" hint, the judgment reader (first 20 paragraphs, show full, search within), Review's "doesn't look like a contract" stop and plain failure reasons, the 503 retry, per-browser privacy, the dataset credit.

## 6. Conflicts with the current code, and things I think are a bad idea

1. **The judgment URL cannot drop the year.** Spec: `/judgments/<court>/<case>`. The data store looks a case up by court, **year** and case id, and a High Court case also needs its 100-case page number (`store.get(court, year, id, page)`). Supreme Court ids start with the year (`2014_INSC_514`) but High Court ids do not. *Plan:* `/judgments/<court>/<year>/<case>` (with `?p=` for High Courts). Changing the lookup would be a backend change.
2. **Chapter and Part headings are damaged in the Act data.** On NI Act section 138 the stored chapter is "XVI O F I N T E R N A T I O N A L LA W" (and some sections carry conflicting chapter values). The spec's Law-page contents "Parts, Chapters, sections" would show garbage. *Plan:* the contents lists sections by number and heading (as in the mock-up), with a note that chapter headings are left out. Orders/Rules and Schedules show where the data has them. Fixing chapters is a data task, not a screen task.
3. **"Your documents" Search tab has no backend.** Vault search exists only inside Ask (`lib/chat/retrieve` + `vault/lexical`); there is no `/api/vault/search`. The tab needs one thin read-only route that reuses that code, plus a query embedding for "by meaning". *Decision for you:* add the route (a small backend addition, no logic change) or ship the tab as exact-words only, or leave it out of this round.
4. **Voyage's free limit (3 requests a minute for the whole app, 2 already reserved for document embedding) cannot afford per-tab counts.** Searching "by meaning" in Laws, Regulators, Judgments and Your documents at once would use several embedding calls per search. *Plan:* only the active tab searches; other tab counts show after you open them (or use exact-words counts, which cost nothing). The mock-up's counts are sample numbers. Quick-find uses exact and keyword search only, never an embedding per keystroke.
5. **Desk's box guessing the intent can misroute.** "A case name opens the judgment" has no reliable test; "State v. Kumar" and "what is bail" look alike to a program. *Plan:* classify with simple rules (a section citation, `X v. Y`, a question mark or a question word), show one line under the box saying what Enter will do ("Opens Ask", "Opens the law page", "Searches"), and let a keypress switch. If the guess is unsure, go to Search, which is the safe default.
6. **"Judgments that cite this section" (Law page margin) needs a reverse index we do not have.** Today the app finds the laws a judgment cites (per judgment, when you open it); it cannot list judgments for a section. Building the index is a data job over 37,014 judgments. *Plan:* the margin shows a link, "Search judgments that mention this section" (the existing judgment text search), and the mock-up's list is labelled as sample until the index exists.
7. **Making Privacy, Terms and Security public touches the access gate.** The gate is a security control: today only `/access` and its API are public. The spec needs three more public paths. *Plan:* add exactly three exact paths to `isPublicPath` with tests that every other path still needs the password. Needs your OK because it is a security-relevant change, though not a backend feature.
8. **"Remove all Vaquill wording" must not remove the dataset credit.** The Acts and judgments come from open-india-law, published by Vaquill AI under CC BY 4.0, which requires attribution. The credit appears in `DataAttribution`, the Acts and judgments attribution objects and `NOTICE.md`. *Plan:* remove Vaquill product wording and the copied pages, keep the credit as a plain "Data: open-india-law by Vaquill AI (CC BY 4.0)" line.
9. **The spec does not say what happens to the 37 copied marketing pages, the six extra legal pages, the contact form, or the Review/Drafting feature flags.** *Plan (section 1):* remove all marketing pages and `contact` (the footer gets an email link); keep three legal pages with Cookies and data deletion as sections of Privacy; keep the flags in `workspace.json`.
10. **A general "Feedback" menu item has no backend.** `/api/feedback` only stores thumbs and reasons for an answer, draft or review that belongs to the browser. *Plan:* the menu's Feedback is an email link for now. A free-text feedback form would be a new backend feature.
11. **"Recent work" on Desk needs three calls** (chats, drafts, reviews; each already exists). Fine for a first version; merge them into one list in the browser.
12. **Marked page and the Ask right pane for judgments.** For an Act citation the pane can show the whole section with the passage marked. For a judgment citation the API returns the cited passage only, not the full text, so the pane shows the passage marked plus a link to the full judgment at that paragraph. This is honest but less than the spec's "opened at the exact paragraph" for judgments.
13. **Phone sheet for the cited page.** Spec: slide up from the bottom. Works, but it covers the answer while open; the mock-up shows that state. Closing it by swipe-down, Esc and a visible Close button is part of the build.
14. **Bad idea: dropping dark mode forever.** You chose light only now, which is fine; the tokens are structured so a dark theme later is a token change, not a rewrite.
15. **Visual sources.** I used only `lexbharat.ai`'s published values as recorded in the design repo (palette, fonts, radii, pilcrow geometry). I did not open lexbharat.ai (the spec says it blocks automated tools) and did not use any Vaquill teardown file or screenshot. The design repo has **no licence file**; since you own it, no action, but say so if that changes.

## 7. Risks and how each phase limits them

- **Broken links after the move.** Redirects first (Phase 1/3), `routes.ts` for new links, and the existing scripts re-pointed and re-run.
- **A feature disappearing.** Phase checks include a pass of search, Ask (with a Vault document), Drafting (generate, edit, export), Review (run, export), Vault (upload, preview, rename, download, delete), judgment reader, feedback.
- **Fixed bars on phones hiding content.** Tab bar and sheet are tested at 375 px with the keyboard open and on the longest reading pages.
- **Voyage and Gemini limits.** No new model calls are added except as described in items 3 and 4.

## 8. Appendix: files removable now (95)

```
app/(auth)/auth/forgot-password/page.tsx
app/(auth)/auth/login/page.tsx
app/(auth)/auth/signup/page.tsx
app/(auth)/layout.tsx
app/(console)/developer/layout.tsx
app/(console)/developer/page.tsx
app/(console)/layout.tsx
app/(docs)/docs/[...slug]/page.tsx
app/(docs)/docs/layout.tsx
app/(docs)/docs/llms.txt/route.ts
app/(docs)/docs/page.tsx
app/(site)/about/page.tsx
app/(site)/affiliates/page.tsx
app/(site)/alerts/page.tsx
app/(site)/blog/[slug]/page.tsx
app/(site)/blog/page.tsx
app/(site)/brand/page.tsx
app/(site)/claude-plugin/page.tsx
app/(site)/clauses/[slug]/page.tsx
app/(site)/clauses/page.tsx
app/(site)/contact/page.tsx
app/(site)/customer/[slug]/page.tsx
app/(site)/customer/page.tsx
app/(site)/engineering/[slug]/page.tsx
app/(site)/engineering/page.tsx
app/(site)/for-lawyers/ethics/page.tsx
app/(site)/for-lawyers/page.tsx
app/(site)/in/page.tsx
app/(site)/layout.tsx
app/(site)/legal-aid/page.tsx
app/(site)/legal-api/page.tsx
app/(site)/mcp/page.tsx
app/(site)/open-us-law/page.tsx
app/(site)/page.tsx
app/(site)/partners/page.tsx
app/(site)/playbooks/[slug]/page.tsx
app/(site)/playbooks/page.tsx
app/(site)/playground/page.tsx
app/(site)/slack/page.tsx
app/(site)/support/page.tsx
app/(site)/topics/[slug]/page.tsx
app/(site)/topics/page.tsx
app/(site)/use-case/legal-tech-developers/page.tsx
app/(site)/white-label/page.tsx
app/(site)/word/page.tsx
app/(site)/word/sideload/page.tsx
app/api/mock/acts/list/route.ts
app/api/mock/forms/[kind]/route.ts
app/api/mock/playground/route.ts
app/api/mock/resolve/route.ts
app/api/mock/search/route.ts
app/api/mock/subscribe/route.ts
app/api/mock/watches/route.ts
app/api/playground/run/route.ts
app/api/playground/spec/route.ts
components/AccessAndDemo.tsx
components/AlertsClient.tsx
components/CoverageMap.tsx
components/DocsShell.tsx
components/Hero.tsx
components/HomeClosing.tsx
components/Hub.tsx
components/HubList.tsx
components/McpSetup.tsx
components/PlaygroundClient.tsx
components/PricingFaq.tsx
components/Proof.tsx
components/Reveal.tsx
components/SiteFooter.tsx
components/console/DeveloperConsole.tsx
components/console/Listbox.tsx
components/console/PlaygroundApp.tsx
components/docs/CopyPage.tsx
components/docs/DocsCode.tsx
components/docs/DocsIcons.tsx
components/docs/DocsToc.tsx
components/docs/PageFeedback.tsx
data/company.ts
data/corpus.ts
data/docs/nav.ts
data/docs/pages.ts
data/endpoints.ts
data/hubs.generated.ts
data/hubs.ts
data/india.ts
data/jurisdictions.ts
data/mcpTools.ts
data/playgroundSpec.ts
data/stateBreakdown.ts
data/usMapPaths.ts
lib/mockStore.ts
lib/playgroundCode.ts
lib/playgroundFixtures.ts
lib/playgroundMock.ts
lib/useMockKey.ts
```
