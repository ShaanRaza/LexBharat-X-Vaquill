# Architecture, tools and libraries

## The big picture

```
Your browser  ──►  Next.js dev server (this project, on your computer, port 3100)
                      ├─ Pages (React)          src/app/**/page.tsx          (42 page files → ~590 URLs)
                      ├─ Shared pieces          src/components/*.tsx         (21 files)
                      ├─ Static content files   src/data/*.ts                (11 files + 2 in docs/)
                      ├─ Brand files            public/brand/*.svg           (7 original logos)
                      └─ Mock API routes        src/app/api/mock/**/route.ts (6 routes) + src/app/api/playground/{spec,run} (2 routes, console Playground)
                                                  └─ simulated in-memory store  src/lib/mockStore.ts
                      + one text route:         /docs/llms.txt
```

There is **one program** (the Next.js dev server). It serves the pages and also answers the mock API requests. Nothing else runs and nothing connects to the internet except fonts fetched from Google Fonts during development.

## Tools, frameworks and packages

| Name | Version | What it does here |
|---|---|---|
| **Next.js** | 15.5.28 | Web framework: routing (a folder = a URL), server rendering, API routes |
| **React** | 19.1.10 | Builds the screens from components |
| **TypeScript** | 5.9.x | JavaScript with types (catches mistakes while editing) |
| **Tailwind CSS** | 3.4.19 | Styling with utility classes; colors come from design tokens in `globals.css` |
| **PostCSS / Autoprefixer** | 8.5.x / 10.6.x | Build tooling Tailwind needs |
| **Lenis** | 1.3.27 | Smooth scrolling (the public site uses it too) |
| **next/font (Google Fonts)** | built in | Schibsted Grotesk (text), Source Code Pro (code), Newsreader (headline serif, an approximation) |

Only four runtime packages are installed (`next`, `react`, `react-dom`, `lenis`). The map, accordions, tabs, forms, docs search, blog search and pagination are hand-written.

## Folder map

```
vaquill-local/
├─ README.md                      Overview and how to run
├─ lexbharat-docs.zip             README + markdown docs + playground-evidence.md + QA scripts/reports (no images; teardown and recut files withheld, see docs/BUNDLE-NOTES.md)
├─ docs/                          Explanation files + screenshots (see list in README)
├─ package.json                   Scripts and dependencies (dev runs on port 3100)
├─ tailwind.config.ts             Maps design tokens to Tailwind color names
├─ public/brand/                  Original LexBharat logo SVGs (7 files)
├─ qa/                            Pre-launch QA: report, running log, audit scripts, 582x3 screenshots (see qa/QA-REPORT.md)
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx               Root: fonts, page title, smooth scroll
│  │  ├─ globals.css              Design tokens + a few shared classes
│  │  ├─ icon.svg                 Browser tab icon
│  │  ├─ favicon.ico/route.ts     Redirects the browser default /favicon.ico to icon.svg
│  │  ├─ not-found.tsx, error.tsx Branded 404 and error pages
│  │  ├─ (site)/                  Marketing, content and legal pages (shared nav + footer)
│  │  ├─ (console)/developer/     Developer console clone: Playground, Overview, API Keys (own shell, no site nav); see docs/PLAYGROUND-BUILD.md
│  │  ├─ (docs)/docs/             Documentation (own layout: top bar, tabs, sidebar, search)
│  │  ├─ (auth)/auth/             Sign in / sign up shells (own minimal layout)
│  │  └─ api/mock/                The mock backend (6 route files)
│  ├─ components/                 Reusable screens and widgets (see below)
│  ├─ data/                       All static content (see DATA-FLOW.md)
│  └─ lib/mockStore.ts            The simulated in-memory "database"
```

The parentheses in `(site)`, `(docs)` and `(auth)` are *route groups*: they let sections share a layout without changing the URL.

## Pages, templates and how many URLs each makes

| Template | Makes |
|---|---|
| One `page.tsx` per top-level page | ~30 pages (home, product, company, tools, auth) |
| `(site)/[legal]/page.tsx` + `security/page.tsx` | 9 legal pages from `data/legal.ts` |
| `blog|engineering|clauses|topics|playbooks/[slug]` | 459 + 24 + 52 + 10 + 4 detail pages from `hubs.generated.ts` |
| `customer/[slug]` | 1 story |
| `(docs)/docs/[...slug]` | 58 docs pages + 2 aliases |
| Special pages (`ethics`, `vulnerability-disclosure`, `use-case`) | 3 outline pages from `data/extraPages.ts` via `StructuredPage.tsx` |

## Major components

| Component | Role |
|---|---|
| `Nav.tsx` | Top navigation and the LexBharat wordmark (reused in footer and docs) |
| `SiteFooter.tsx` | Shared footer: 3 link groups, quick links, mock newsletter form |
| `Hero.tsx`, `Proof.tsx`, `CoverageMap.tsx`, `AccessAndDemo.tsx`, `PricingFaq.tsx`, `HomeClosing.tsx` | The sections of the home page |
| `ui.tsx` | Building blocks used by every inner page (`PageHero`, `Section`, `Card`, `CodeBlock`, `SimpleTable`, `CtaBand`, `DataNote`, …) |
| `MockForm.tsx` | One generic form used by contact, legal aid, affiliates, delete-data, sign in/up |
| `PlaygroundClient.tsx` | The API Playground console |
| `DocsShell.tsx`, `docs/*.tsx` | Docs chrome (announcement bar, header, tabs, sidebar) and docs page parts (Copy page, On this page rail, code block, feedback); see `docs/DOCS-SHELL.md` |
| `AlertsClient.tsx` | Create and delete "watches" against the simulated database |
| `McpSetup.tsx` | Client tabs with setup snippets on the MCP page |
| `DocsShell.tsx` | Docs top bar, four tabs, 58-entry sidebar, ⌘/Ctrl-K title search |
| `Hub.tsx`, `HubList.tsx` | Index (search, category filter, pagination) and article templates for the five content hubs |
| `LegalView.tsx` | Renders a legal page: contents list, numbered sections, "recreated placeholder" notice |
| `StructuredPage.tsx` | Renders an outline-based page (ethics, vulnerability disclosure, use case) |
| `MockBadge.tsx` | The small "MOCK" / "recreated placeholder" label |
| `SmoothScroll.tsx`, `Reveal.tsx` | Smooth scrolling and scroll-in animations (both respect "reduce motion") |

## Server vs. browser code

- **Server components** (default): most pages. They render once and send plain HTML.
- **Client components** (`"use client"`): anything interactive: map, forms, tabs, Playground, Alerts, docs shell, hub lists, nav menu.

## Design tokens

Colors, radii and easing live in `src/app/globals.css` as CSS variables (and as RGB channels so Tailwind's opacity classes such as `bg-primary/15` work). Values were read from the public site's stylesheet, except the serif headline font, which could not be identified and is approximated.

## Running and building

```bash
npm run dev     # development server on http://localhost:3100
npm run build   # production build (not run as part of this project's checks)
npm run start   # serve the production build
```

Type-checking (`npx tsc --noEmit`) passes.
