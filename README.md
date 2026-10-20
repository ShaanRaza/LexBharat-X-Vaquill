# LexBharat (local build)

A local, educational recreation of the **publicly visible** website of a US-primary-law API company, branded **LexBharat**. It is a website you can click through on your own computer: about **590 pages**, a documentation site, and mock tools that behave like the real ones. It has **no real backend, no real database and no real accounts**.

> **In one sentence:** everything you see is real *front-end*; everything that looks like it talks to a server is a *mock* running on your own machine.

## Run it

```bash
npm install        # first time only
npm run dev        # http://localhost:3100
```

Open **http://localhost:3100**. Stop with `Ctrl+C`. (The app always starts on port 3100; this is set in `package.json`.)

## What it recreates

| Area | Pages | How complete |
|---|---|---|
| Home page | `/` | **Full**: hero, interactive US map, API demo (mocked), pricing, FAQ, footer |
| Product pages | `/legal-api`, `/mcp`, `/claude-plugin`, `/white-label`, `/affiliates`, `/open-us-law`, `/legal-aid`, `/in`, `/word`, `/word/sideload` | **Full** structure, placeholder copy |
| Interactive tools | `/playground`, `/alerts` | **Mocked** but fully working in the browser |
| Company pages | `/about`, `/customer` (+ story), `/contact`, `/partners`, `/support`, `/brand`, `/slack` | **Full** (fictional people; `/slack` is a redirect shell) |
| For lawyers | `/for-lawyers`, `/for-lawyers/ethics`, `/use-case/legal-tech-developers`, `/security/vulnerability-disclosure` | **Partial**: headings and order observed, wording placeholder |
| Content hubs | `/blog` (459), `/engineering` (24), `/clauses` (52), `/topics` (10), `/playbooks` (4), each with detail pages | **Partial**: every public title is listed with search and filters; article bodies are placeholders |
| Legal pages | `/privacy`, `/terms`, `/dpa`, `/sla`, `/cookies`, `/refund-policy`, `/delete-data`, `/security`, `/accessibility` | **Partial**: real section structure, original placeholder wording, clearly labeled |
| Documentation | `/docs` with 58 sidebar entries, 4 tabs, search, 12 endpoint reference pages, `llms.txt` | **Partial**: all pages exist with original explanatory text |
| Sign in / Sign up | `/auth/login`, `/auth/signup`, `/auth/forgot-password` | **Shell** (mock) |

The full page-by-page table, with data source and screenshot for each, is in [`docs/PAGES-AND-DATA-MAP.md`](docs/PAGES-AND-DATA-MAP.md).

## What is real vs. mocked (the short version)

- **Real in this project:** the screens, layout, colors, fonts, animations, menus, tabs, accordions, the docs search box, the map hover, blog search and pagination, and form validation.
- **Mocked:** every form, the home-page API demo, the Playground and Law Change Alerts. They call small local stubs under `/api/mock/*` (6 route files).
- **Simulated database:** the Alerts page stores "watches" in server memory. It resets whenever the server restarts.
- **Placeholder content:** logos, testimonials, founders, customers, article bodies, legal wording and screenshots are made up or generic.
- **Not implemented at all:** accounts, API keys, billing, email, analytics, ads, tracking cookies, the Word add-in, the MCP server.

Every page ends with a small **"data source"** strip that says where its content comes from, and recreated legal and docs pages carry a visible **"recreated placeholder"** notice.

## Release toggle (hide dev-only annotations)

One build-time flag, `NEXT_PUBLIC_RELEASE`, controls every dev/demo marker (orange banner, MOCK badges, data-source notes, "(local mock)" titles, placeholder disclaimers). Public content and layout are unchanged.

| Command | Annotations |
| --- | --- |
| `npm run dev` | shown (`.env.development` sets `0`) |
| `npm run build && npm run start` | hidden (`.env.production` sets `1`) |
| `npm run dev:release` | hidden, in dev |
| `npm run build:demo` | shown, in a production build |

Shell variable beats `.env.local` beats the `.env.*` defaults. The value is inlined at build time, so rebuild (or restart dev) after changing it. Code reads it through `src/lib/release.ts` and `src/components/DevOnly.tsx`.

## Where to read more

| File | What it explains |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Tools, libraries, folders and major components |
| [`docs/DATA-FLOW.md`](docs/DATA-FLOW.md) | Where data lives, which mock API powers which screen |
| [`docs/PAGES-AND-DATA-MAP.md`](docs/PAGES-AND-DATA-MAP.md) | Every page: full / partial / mocked, data kind, files, screenshots |
| [`docs/PUBLIC-EVIDENCE.md`](docs/PUBLIC-EVIDENCE.md) | What was observed on the real public site |
| [`docs/ASSUMPTIONS-AND-UNKNOWNS.md`](docs/ASSUMPTIONS-AND-UNKNOWNS.md) | What could and could not be verified; what is approximated |
| [`qa/QA-REPORT.md`](qa/QA-REPORT.md) | **Pre-launch QA sign-off**: what was tested on every page, the issue register, fixes, and open items (marketing-site pass of 582 pages, plus addenda for the release toggle and the developer console; screenshots in `qa/screenshots/` and `qa/playground/`) |
| [`docs/SCREENSHOTS.md`](docs/SCREENSHOTS.md) | 30 desktop and 16 mobile screenshots, mapped to pages |

A zipped bundle (`lexbharat-docs.zip`, no images) holds the README, the markdown docs, `playground-evidence.md` and the QA scripts and reports. Two files are deliberately **not** in it: `docs/PLAYGROUND-TEARDOWN.md` (logged-in session material) and `recut-evidence.md` (local paths and installed-app inventory); see `docs/BUNDLE-NOTES.md`.

## Deploying to Vercel

The project is a standard Next.js 15 app (no `output` setting, no custom server, no required secrets). The only environment variable is `NEXT_PUBLIC_RELEASE`: `1` hides dev/demo annotations and is baked in at build time. `.env.production` already sets it to `1`; pass it explicitly as well so a deploy never depends on that file. `.vercelignore` keeps `qa/`, screenshots, the docs zip and the evidence files out of the upload. From this folder (after `vercel login`):

```bash
vercel --prod -b NEXT_PUBLIC_RELEASE=1
```

Caveat: the Law Change Alerts demo stores its list in server memory, which does not persist reliably on serverless hosting. The site is `noindex` by design.

## Acts & Judgments browser (mock)

`/workspace/browse` recreates the "Browse Laws & Judgments" area (Supreme Court and High Courts with year pickers, plus an Acts & Legislation tab backed by a mock `/api/mock/acts/list`). All data is mock or display data; the real corpus is not accessible. What was investigated and found is in [docs/ACTS-AND-JUDGMENTS.md](docs/ACTS-AND-JUDGMENTS.md).

## Developer console Playground (internal REA clone)

`/developer?tab=playground` is a local, fully mocked recreation of the authenticated Vaquill Playground, built from `docs/PLAYGROUND-TEARDOWN.md` (project only; withheld from the zip). What was built, what is mocked vs confirmed, and the remaining gaps are in [docs/PLAYGROUND-BUILD.md](docs/PLAYGROUND-BUILD.md). The console always shows that it is a local mock, even in release builds. Re-run its browser QA (app must be on port 3100) with `node qa/playground-qa.mjs`.

## Boundaries followed

Only publicly visible pages were inspected: the home page, the pages listed in the site's public sitemap, the public docs and the sign-in/sign-up screens (viewed only). Nothing behind a login, nothing under disallowed paths (`/api/`, `/_next/`, `/private/`), no private or hidden endpoints, and no forms submitted on the real site. Nothing here claims to reveal the real site's source code, backend or database.
