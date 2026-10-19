# LexBharat local build: pre-launch QA sign-off report

> **Freshness note (2026-10-20).** The body of this report is the **marketing-site** QA from the original 582-route pass and is kept as the record of that pass (its counts, "dev server" framing and screenshot numbers are as of then). Later changes are in the addenda at the end: Addendum 1 (release toggle, 651 routes) and **Addendum 2 (release-readiness pass: developer console, production, current counts, new findings)**. Where they differ, the addenda are current.


**Scope:** the whole public experience served at `http://localhost:3100` (Next.js 15.5.28 dev server): 582 HTML routes (home, product, company, tools, legal, docs, auth shells, 5 content hubs) plus 9 asset/text routes.
**Date:** 2026-10-19. **Tester:** automated QA pass with manual visual review. Running log: [`QA-LOG.md`](QA-LOG.md).

## 1. Executive summary

| | |
|---|---|
| **Verdict** | **Ready for local sign-off / demo.** Not ready for a *public* launch until the "needs your decision" items in section 6 are resolved (they are product decisions, not defects). |
| Critical issues found | **0** |
| High issues found | **2**, both fixed and re-tested |
| Medium issues found | **7**, all fixed |
| Low issues found | **17**, all fixed (1 is dev-server-only and not an app defect) |
| Informational | 1 (dev-server auto-restart under heavy load) |
| Final state | 582/582 routes return 200 · 0 console/exception/network errors on any page at desktop or mobile · 0 broken internal links · 0 horizontal overflow / clipped / overlapping content at 390 px · type-check clean |

The two High issues: (1) scroll-reveal sections could stay **invisible** (no JavaScript, or a browser not delivering observer events), and (2) the **US-map state labels** fell as low as 2.3:1 contrast. Both are fixed and verified.

## 2. What was tested (coverage)

| Check | Coverage | Method |
|---|---|---|
| Page renders (HTTP 200) | **all 582 routes**, 3 full crawls from `/` following every link | `qa/crawl_routes.py` |
| Static HTML audit | **all 582 routes**: title, meta, lang, viewport, h1 count, heading order, alt text, field labels, duplicate ids, anchor targets, unknown internal links, dead `href="#"`, placeholder/brand leakage | `qa/audit_static.py` |
| Console, exceptions, failed requests, HTTP >= 400 | **all 582 routes x desktop (1280) and mobile (390)**; 111 routes x tablet (820) | `qa/cdp-audit.mjs` (headless Chrome over DevTools Protocol, true device emulation) |
| Layout audit (overflow, off-screen, clipped text, overlaps, nav/heading collisions, tap targets, broken images, stuck reveals, landmarks, contrast) | same page x breakpoint matrix | in-page DOM audit inside the harness |
| Screenshots (full page, up to 3200 px) | 582 desktop, 582 mobile, 111 tablet | `qa/screenshots/` |
| Interactions | home map (zoom, reset, layer tabs, tile readout), FAQ, API demo (Visual/JSON), newsletter, nav, docs search + 4 docs tabs, all 7 forms (empty / invalid / valid), Alerts (invalid, email, webhook, delete), Playground (2 endpoints, Visual/JSON), blog (search, next/prev, open article), clauses category filter, MCP tabs, branded 404 and "Back to home" | REA browser scenarios, serial on an idle machine |
| Mock API robustness | 26 hostile/invalid-input cases across all 6 endpoints (bad JSON, empty, wrong types, HTML in fields, long input, wrong methods, unknown ids) | `curl` |
| Keyboard accessibility | skip link is first Tab stop, visible, activates; 25-stop Tab sweep with focus-ring check on 6 templates | `qa/keyboard-test.mjs` |
| Colour contrast | all text/background token pairs computed (WCAG ratios) + per-element audit on every page | Python + in-page |

**Not covered (limits of this environment):** only Chromium was available (no Safari/Firefox/real phones); no screen-reader run; no performance/Lighthouse numbers (dev mode is not representative); `npm run build` was not run because it would overwrite the folder the running dev server uses.

## 3. Issue register

Severity: **C**ritical / **H**igh / **M**edium / **L**ow. Status: **Fixed** unless stated.

| ID | Route / scope | Issue | Sev | Change made |
|---|---|---|---|---|
| Q1 | every page with `Reveal` (home: 21 blocks) | Below-the-fold sections hidden with CSS and revealed only by an IntersectionObserver. With no JS / a throttled or absent observer they stay at `opacity:0`. Seen in two environments. | **H** | `Reveal.tsx`: visible by default; hidden only after hydration and only if below the fold; revealed by observer **and** a scroll/resize position check; `@media print` forces visible |
| Q2 | `/` US map | State labels used a fixed light/dark threshold: 68 of 153 tile/layer combos < 4.5:1, worst 2.3:1 | **H** | `CoverageMap.tsx`: 5-step scale skipping the unreadable mid-luminance band; all labels >= 6.5:1 |
| Q3 | 80 hub titles/slugs | Old brand name in blog titles and URLs | M | `hubs.generated.ts` rebranded (17 renames, incl. slugs) |
| Q4 | `/security`, legal pages | Old brand name in 4 legal headings | M | `legal.ts` rebranded; 0 occurrences remain in `src/` |
| Q5 | all forms/inputs | Field borders 1.43:1 against white (needs 3:1) | M | New `--control-border` token (4.6:1 on white) on every input/select |
| Q6 | every page | No "skip to main content" link; `<main>` not focusable | M | Skip link in root layout; `id="main" tabIndex={-1}` on every main |
| Q7 | unknown URLs | Default unbranded Next.js 404; no error page | M | `not-found.tsx`, `error.tsx` (branded, with links) |
| Q8 | `/auth/*` | No `<main>` landmark | M | `(auth)/layout.tsx` uses `<main>` |
| Q9 | `/alerts` | No loading/error state: slow/failed load showed an empty select, disabled button, "No watches yet" | M | `AlertsClient.tsx`: loading, error + Retry, handles network failure on create/delete |
| Q10 | `/api/mock/watches` | Accepted any text as target (incl. HTML), no cap, 500 on non-string | L | Validates email / https URL, caps length (200) and list (50), rejects non-strings |
| Q11 | 579 pages | Tap targets < 24 px (nav community icon, footer quick links, docs Home, prev/next, "Read the story", "Learn more", Alerts Delete, brand "svg"), docs hamburger squeezed by flex | L-M | Padding/min-size on all; `shrink-0` on menu buttons |
| Q12 | all pages | Footer group headings `h4` skipped levels | L | `h2` |
| Q13 | `/blog`, `/contact`, `/customer`, `/support`, docs FAQ | Card/section `h3` directly under `h1` | L | Card `as` prop; hub cards, contact aside, customer, support, FAQ use `h2` |
| Q14 | `/claude-plugin`, `/open-us-law`, home demo | Dead `href="#"` buttons jump to top | L | Disabled, labeled non-links (`PageHero` `disabled`); mock result links are plain text |
| Q15 | `/docs/introduction`, `/docs/guides/mcp-client` | Alias pages had generic `<title>` "Docs" | L | `generateMetadata` resolves alias to target title |
| Q16 | all `MockForm`s | Copy: "Submitting stores and sends nothing." | L | "stores nothing and sends nothing" |
| Q17 | home | Hero text 16 px left of the nav logo; AI-assistant card outside the nav's right edge | L | `Hero.tsx` alignment |
| Q18 | home | Film/testimonial/cards 16 px left of the nav (1216 px + padding container) | L | `Proof.tsx` container 1152 px |
| Q19 | footer | Quick-link row wrapped awkwardly; dangling `·` separators | L | No-wrap links, gap-based layout |
| Q20 | blog/engineering/topics | Same placeholder sentence repeated on all 24 cards per page | L | Card summary omitted when generic; article lead has a fallback |
| Q21 | `/brand` | Large "light" wordmark kept the maroon leaf (dim on near-black) | L | Light leaf for `light` wordmark |
| Q22 | `/` customer names | Decorative text `text-muted/80` = 3.91:1 | L | `text-muted` (6.1:1) |
| Q23 | docs pages | Eyebrow showed raw slug ("API-GUIDE / CONCEPTS") | L | Shows the sidebar section name |
| Q24 | browsers on a fresh profile | `/favicon.ico` 404 | L | `favicon.ico/route.ts` redirects to `/icon.svg` |
| Q25 | home, phones | Hero highlight became one wide box when the phrase wrapped | L | Fixed earlier (inline per-line highlight below 640 px) |
| Q26 | test environment | Dev server returned 500 for 4 legal routes under 6 simultaneous cold requests (`__webpack_require__.C is not a function`) | L (dev only) | Not reproducible after warm-up; not an app defect. Audits warm routes first |
| Q27 | test environment | Dev server auto-restarted ("approaching the used memory threshold") during a very heavy crawl; Alerts list reset | Info | Dev-mode behaviour; production build pre-renders pages |

## 4. Before / after notes (meaningful fixes)

- **Q1 reveal:** *Before:* in the in-app browser (observers never fired) 0 of 21 home blocks appeared after scrolling the whole page; mobile screenshots showed blank bands where the film, testimonial and comment cards belong. *After:* 21 of 21 appear; mobile home screenshot (`qa/screenshots/mobile/home.jpg`) shows every section.
- **Q2 map:** *Before:* lowest label contrast 2.32:1 (68/153 failing). *After:* lowest 6.57:1 (all 5 steps pass).
- **Q11 tap targets:** *Before:* 579 of 582 desktop pages and 579 mobile pages flagged. *After:* 0 on desktop and 0 on mobile on the final 111-page regression set (only the `/brand` false positive remains).
- **Q9 alerts:** *Before:* a slow load rendered a dead-looking form. *After:* "Loading sources…", "Sources unavailable" + Retry, and inline errors.
- **Q7 404:** *Before:* plain black-on-white Next.js default. *After:* branded page with Home, Docs and Contact buttons.

## 5. Final results (end state)

| Pass | Pages | Console / network events | Audit issues |
|---|---|---|---|
| Desktop 1280 (full) | 582 | **0** | 2 (both resolved by later fixes; remaining hit is the `/brand` false positive) |
| Mobile 390 (full) | 582 | **0** | 61 (docs menu button; fixed and re-tested clean) |
| Tablet 820 | 111 | **0** | `/brand` false positive only |
| End-state regression (desktop + mobile, 111 pages) | 222 loads | 1 favicon 404 (fixed, re-tested clean) | `/brand` false positive only |
| Static audit | 582 | n/a | 0 critical, 0 high; 53 medium = 52 third-party product names in titles + 1 false positive; 3 low = alias titles |
| Link crawl | 588 URLs | n/a | 0 broken |

*The `/brand` LOW-CONTRAST hit is a false positive: the audit measured the `<a>` element's colour, but the visible label is a child span in a light colour on the dark tile (verified visually).*

## 6. Unresolved / needs support from you (prioritised)

| # | Item | Why it is open | What I need |
|---|---|---|---|
| 1 | **Visible dev annotations**: the orange "local build / MOCKED" banner, the "data source" strip at the bottom of every page, MOCK badges | Intentional for this local build and documented, but they must not ship on a public site | Decision: keep for the demo, or ask me to add a single switch (env flag) to hide them |
| 2 | **Placeholder content** (legal pages, docs text, hub article bodies, customers, founders, logos) | Original placeholder wording with visible notices; legal text has no legal effect | Real copy and real legal documents from you / counsel |
| 3 | **Third-party names in 52 blog titles** (e.g. "Harvey" comparisons) | Kept as titles from the public listing; naming competitors in titles is a content/legal-review decision | Approve or ask me to neutralise |
| 4 | **Production build not run** | `npm run build` would overwrite the folder the running dev server uses | Stop the dev server, run `npm run build && npm run start` once, then I can re-run this QA against it (recommended before any deployment) |
| 5 | **`npm audit` dev-tooling advisories** (PostCSS chain under Tailwind 3) | Fix means upgrading packages | Your approval to install/upgrade (I do not install without asking) |
| 6 | **Cross-browser / real-device / screen-reader testing** | Only Chromium available here | Check Safari (macOS/iOS) and one Android device; ideally one VoiceOver pass |
| 7 | Duplicate `<title>` on 3 docs URLs (`/docs/introduction`, `/docs/guides/mcp-client`, API Overview) | They are aliases of the same page, as on the public site | None, or ask me to add canonical links |
| 8 | Repeated generic sentences across legal/docs/hub placeholders | By design for placeholders | Real content replaces it |

## 7. Files changed

**Application code**
`src/app/layout.tsx`, `src/app/globals.css`, `src/app/not-found.tsx` (new), `src/app/error.tsx` (new), `src/app/favicon.ico/route.ts` (new), `src/app/api/mock/watches/route.ts`, `src/app/(site)/layout.tsx`, `src/app/(site)/brand/page.tsx`, `src/app/(site)/claude-plugin/page.tsx`, `src/app/(site)/contact/page.tsx`, `src/app/(site)/customer/page.tsx`, `src/app/(site)/open-us-law/page.tsx`, `src/app/(site)/support/page.tsx`, `src/app/(auth)/layout.tsx`, `src/app/(docs)/docs/[...slug]/page.tsx`,
`src/components/`: `AccessAndDemo.tsx`, `AlertsClient.tsx`, `CoverageMap.tsx`, `DocsShell.tsx`, `Hero.tsx`, `Hub.tsx`, `HubList.tsx`, `MockForm.tsx`, `Nav.tsx`, `PlaygroundClient.tsx`, `PricingFaq.tsx`, `Proof.tsx`, `Reveal.tsx`, `SiteFooter.tsx`, `ui.tsx`,
`src/data/`: `hubs.generated.ts`, `hubs.ts`, `legal.ts`, `docs/pages.ts`

**QA tooling and evidence (new, in `qa/`)**
`QA-REPORT.md`, `QA-LOG.md`, `crawl_routes.py`, `audit_static.py`, `cdp-audit.mjs`, `keyboard-test.mjs`, `layout-audit.js`, `sweep.sh`, `analyze_logs.py`, `routes.txt`, `routes-tablet.txt`, `assets.txt`, `logs/`, `screenshots/`

## 8. Screenshots

| Set | Location | Count | Notes |
|---|---|---|---|
| Desktop 1280 px, full page | `qa/screenshots/desktop/<route>.jpg` | 582 (plus reruns of a few) | `/` = `home.jpg`; nested routes use `__`, e.g. `docs__api-guide__quickstart.jpg` |
| Mobile 390 px, true device emulation | `qa/screenshots/mobile/<route>.jpg` | 582 | |
| Tablet 820 px | `qa/screenshots/tablet/<route>.jpg` | 111 | all non-hub pages + 6 samples per hub |
| Raw audit results | `qa/logs/cdp-*.json` | per breakpoint | each record: route, issues, console/network events, page height |

Total size about 125 MB. Earlier project screenshots remain in `docs/screenshots/`.

## 9. How to re-run this QA

```bash
npm run dev                                   # in one terminal (port 3100)
python3 -I qa/crawl_routes.py                 # enumerate routes
python3 -I qa/audit_static.py                 # static audit of every page
node qa/cdp-audit.mjs desktop mobile          # full DOM/console/network audit + screenshots
node qa/cdp-audit.mjs tablet --routes qa/routes-tablet.txt
node qa/keyboard-test.mjs                     # keyboard / skip-link test
```
Run these one at a time: the audits are CPU heavy and a busy machine causes false timeouts.


## Addendum: release toggle and production pass

- **Route count correction:** the true total is **651 HTML routes**. 582 are reachable by following links from `/`; the other 69 are the clauses/topics/playbooks pages, whose hub index pages are not linked from anywhere. They were audited separately (desktop + mobile) and are clean. Link the hubs from the site if they should be discoverable.
- **Release toggle:** `NEXT_PUBLIC_RELEASE=1` hides all dev-only annotations (see README). Production build (`npm run build && npm run start`, port 3100) was clean at that time with 663 static pages (666 after the developer console and its routes were added; see Addendum 4), 0 warnings.
- **Production results:** all 651 routes return 200; 0 annotation markers (banner, MOCK badges, data-source notes, "(local mock)", `/api/mock`, file paths) across the 582 linked pages; 0 console/page/network errors on 48 key pages (desktop + mobile) and the 69 hub pages. Core flows (docs navigation, contact empty/invalid/valid, login, alerts create/validate/delete, playground, blog paging/search/open, clauses filter/open, 404 and back-to-home) pass: 40/40 steps, 0 console or page errors. Only expected HTTP 400s (validation) and the intentional 404.


## Addendum 2: release-readiness pass (2026-10-20)

**Build under test:** `npm run build` from a clean `.next` (exit 0, **666 static pages**, no warnings), served by `npm run start` on port 3100. Everything below ran against that production server.

| Check | Result | Tool |
|---|---|---|
| Route status sweep: all 651 routes in `qa/routes.txt` plus 11 console URLs (every `/developer?tab=` value, a bogus tab, the spec route) | 662 / 662 return 200 | Python |
| Developer-console Playground, production, 360 / 390 / 820 / 1280 px: drawer, picker (25 options), key gating, run, cancel, cancel-then-rerun race, code snippets (including the missing-comma bug), arrow-key tabs, Recent runs reload, validation, mock notices, sidebar (3 disabled items, 2 bridge pages), `federal` in the real form and API, unique response shape per endpoint, overflow, tap targets, console/network errors | 0 problems at all four widths | `qa/playground-qa.mjs` |
| Marketing smoke set (48 pages) desktop + mobile | 0 console exceptions, 0 failed requests; expected 404 for `/does-not-exist`; `/brand` LOW-CONTRAST (known false positive); home `OFFSCREEN` flagged for the comment marquee (false positive: its container is `overflow: hidden`, no page-level horizontal overflow is reported) | `qa/cdp-audit.mjs` |
| Dev/demo markers on the 651 marketing routes | 0 banner, badge, data-source, "(local mock)", `/api/mock` or file-path markers. Body copy on 10 pages (the legal pages and `/slack`) still says "this build" / "local build" (honest placeholder wording; see caveats) | `qa/release_markers.py` |
| Keyboard: skip link, 25-stop Tab sweep on 6 templates | `/`, `/docs`, `/blog`, `/contact`: 0 problems. `/auth/login` and `/nope`: 2 each, both are the sweep wrapping from the last element to the browser (`BODY`) because those pages have fewer than 25 focusable elements (test artifact, not a defect) | `qa/keyboard-test.mjs` |

**Defects found and fixed in this pass**
- **R1 (accessibility regression, Medium):** the geographic home-page map's 51 state shapes were focusable but had `outline: none` inline, so keyboard focus was invisible (20 of 25 Tab stops on `/` failed the sweep). Fixed in `CoverageMap.tsx` + `globals.css` (`.us-state`): focus now shows a gold 3 px border plus the global focus outline. The sweep now reports 0 problems on `/`.
- **R2 (test-list bug, Low):** `qa/routes-smoke.txt` listed `/playbooks/nda-playbook-negotiation-positions`, which does not exist (real slug `/playbooks/nda-playbook`); it produced a 404 in every smoke run. No page links to it. List corrected.
- **R3 (docs):** `SCREENSHOTS.md`, this report and the README did not describe the console or the geographic map; corrected with notes and sections (see `docs/BUNDLE-NOTES.md`).

**Open caveats (accepted for handoff, with reasons in `docs/BUNDLE-NOTES.md`)**
- All non-Pricing Playground response bodies are invented (labelled mock everywhere: banner, "Mock" pill, `_mock` / `_note` fields).
- `federal` is confirmed from the live product only for search; its acceptance on count, resolve (GET and POST), extract-citations, coverage and boards is inferred.
- Legal pages carry placeholder text (marked "Placeholder"); legal copy was never reviewed by a lawyer.
- Not tested: Safari, Firefox, real phones, screen readers, Lighthouse/performance, `npm audit` upgrades (unchanged, out of scope).


## Addendum 3: docs shell rebuild (2026-10-20)

The documentation area was rebuilt to match the public docs shell and sidebar (details and measurements in `docs/DOCS-SHELL.md`). Checked on the production build (666 pages, clean):

| Check | Result |
|---|---|
| Served sidebar vs the brief (9 groups, order, labels) | exact match; 43 links; all 200; each page's h1 equals its sidebar label; one active item |
| TOC anchors on API Coverage (10 items incl. one sub-level) | all resolve |
| `qa/cdp-audit.mjs` on 11 docs pages at desktop, tablet, mobile (`qa/routes-docs.txt`) | 0 console/network events. Findings fixed: gray `#737171` text at 4.29:1 (now `#65625f`) and two 20 px header links (now 36 px targets). Remaining flags are the audit's TEXT-OVERLAP between the sticky header and sidebar items scrolled out of view inside the sidebar's own scroll area (clipped, not visible: false positive) |
| Mobile drawer | opens below the header, scroll locked, Escape closes, no horizontal overflow |

Known limits: the reference screenshots supplied with the request were not attached, so the match is to the live public page measured directly; no cross-browser or screen-reader testing.


## Addendum 4: Vercel deploy-readiness audit (2026-10-20)

**Page counts, reconciled.** The current production build reports **666 static pages**. That is Next.js's static-generation count, not the number of audited HTML routes: 655 prerendered routes (the **651** audited marketing/docs routes in `qa/routes.txt`, plus `/developer`, `/in`, `/_not-found` and `/icon.svg`) and the remaining entries are generated outputs that are not separate routes (404 and route-handler artifacts). `/in` ("India legal data") exists, returns 200 and is not linked from anywhere (it was never in the link-crawled list). Older figures in this report (582 linked routes, 651 after the hub pages, 663 static pages at the time of Addendum 1) are correct for their dates. The body of the report and `docs/SCREENSHOTS.md` describe the 582-route marketing-site pass and say so; the developer console and the docs shell are covered by Addenda 2 and 3 and by `docs/SCREENSHOTS.md` section 5.

**Checks (clean `.next`, `npm run build`, `npm run start`):** build exit 0, no warnings, 666 pages; 659 of 659 fetched pages return 200 (651 routes + 8 console tabs); 651 unique internal links all resolve; 63 referenced assets all 200; no external hosts loaded at render; no `localhost`, port or absolute-path strings in `src/` or config; no `fs`/`path`/`process.cwd` use; 231 imports checked for case-sensitivity (Linux) with 0 problems; only environment variable is `NEXT_PUBLIC_RELEASE`; dev/demo markers: 0 on the 651 marketing routes; Playground QA 0 problems at four widths; docs audit 0 console/network events; keyboard sweep unchanged (see Addendum 2).

**Known deployment cautions (not defects):** the Law Change Alerts demo (`/alerts`, `/api/mock/watches`) keeps its list in server memory, which does not persist reliably on serverless hosting; the site is noindex by design and has no `robots.txt` or `sitemap.xml`; `.vercelignore` keeps `qa/`, `docs/screenshots/`, the docs zip and the evidence files out of the upload.
