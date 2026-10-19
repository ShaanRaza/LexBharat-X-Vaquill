# Pages and data map (final state)

Every public route in this build, with its **completeness**, **data kind**, **files** and **screenshots**.

## How to read this

**Completeness**

| Label | Meaning |
|---|---|
| **Full** | The whole visible page and its interactions are recreated. Wording is placeholder or original. |
| **Partial** | Structure and navigation are right, but much of the text is a short summary or stand-in. |
| **Mocked** | It behaves like a working feature, but a local stub answers (nothing real happens). |
| **Shell** | Only the visible frame of something that is not publicly reachable (for example sign-in). |

**Data kind**: **Static** = `src/data/*.ts` · **Hardcoded** = copy written in the page/component · **Mock API** = calls `/api/mock/*` · **Sim DB** = in-memory store · **Placeholder** = invented or generic text · **Generated** = listing produced from the public sitemap/listing titles.

Screenshot numbers refer to [`SCREENSHOTS.md`](SCREENSHOTS.md): **D00–D31** = desktop, **M00–M18** = mobile.

---

## 1. Home

| URL | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|
| `/` | **Full** (+ Mocked demo) | Static + Hardcoded + Placeholder + Mock API | `Hero`, `Proof`, `CoverageMap`, `AccessAndDemo`, `PricingFaq`, `HomeClosing` components; `data/jurisdictions.ts`; `/api/mock/resolve` | D00, M00 |

Inside the home page: the map hover/zoom is **Full**; the curl→result demo is **Mocked**; logos, testimonial and comment cards are **Placeholder**; pricing and FAQ copy are **Hardcoded**.

## 2. Product pages

| URL | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|
| `/legal-api` | Full | Static | `data/endpoints.ts` | D01 |
| `/mcp` | Full | Static | `data/mcpTools.ts`, `McpSetup.tsx` | D02 |
| `/claude-plugin` | Full | Static | `data/mcpTools.ts` | – |
| `/playground` | **Mocked** (interactive) | Mock API | `PlaygroundClient.tsx`, `/api/mock/playground`, `data/endpoints.ts`, `data/corpus.ts` | D03, D04, M01 |
| `/developer?tab=playground` | **Mocked** (interactive console clone; not linked from the marketing nav) | Mock API (`/api/playground/*`) | `components/console/*`, `data/playgroundSpec.ts`, `lib/playgroundMock.ts`, `lib/playgroundFixtures.ts` | `qa/playground/` |
| `/auth/login` | **Mocked** sign-in: any valid email stores a fake session in this browser and opens `/developer?tab=playground` | Mock API + browser storage | `MockForm.tsx`, `lib/mockSession.ts`, `/api/mock/forms/login` | – |
| `/developer?tab=overview`, `?tab=api-key` | **Mocked** (minimal) | Browser storage | `components/console/DeveloperConsole.tsx` | – |
| `/developer?tab=law-changes`, `?tab=mcp` | Bridge pages (link to `/alerts`, `/mcp`) | Static | `DeveloperConsole.tsx` | – |
| `/developer?tab=credits`, `billing`, `settings` | **Intentionally not recreated** (disabled in the sidebar; direct URL explains) | none | `DeveloperConsole.tsx` | – |
| `/alerts` | **Mocked** (interactive) | Mock API + **Sim DB** | `AlertsClient.tsx`, `/api/mock/watches`, `lib/mockStore.ts` | D05, M02 |
| `/white-label` | Full | Hardcoded | page file | – |
| `/affiliates` | Full + Mocked form | Hardcoded + Mock API | `/api/mock/forms/affiliate` | – |
| `/open-us-law` | Full (links inert) | Placeholder | page file | D06 |
| `/legal-aid` | Full + Mocked form | Hardcoded + Mock API | `/api/mock/forms/legal-aid` | D07 |
| `/for-lawyers` | Partial (summary cards) | Placeholder | page file | – |
| `/for-lawyers/ethics` | Partial (outline + placeholder text) | Placeholder | `data/extraPages.ts`, `StructuredPage.tsx` | D17, M17 |
| `/in` | Full | Static | `data/india.ts` | D08 |
| `/use-case/legal-tech-developers` | Partial (outline) | Placeholder | `data/extraPages.ts` | D19 |
| `/word` | Full (marketing page only; no add-in exists) | Placeholder | `data/extraPages.ts` | D14, M10 |
| `/word/sideload` | Full (guide steps; download button disabled) | Placeholder | `data/extraPages.ts` | D15 |
| `/slack` | **Shell** (the real URL is an external redirect) | Hardcoded | page file | D16, M11 |

## 3. Company pages

| URL | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|
| `/about` | Full (fictional founders) | Placeholder | `data/company.ts` | – |
| `/customer`, `/customer/example-solo-practice` | Full (one fictional story) | Placeholder | `data/company.ts` | – |
| `/contact` | Full + Mocked form | Mock API | `/api/mock/forms/contact` | D31, M18 |
| `/partners` | Full | Static | `data/company.ts` | – |
| `/support` | Partial | Placeholder | `data/company.ts` | – |
| `/brand` | Full (original logo files) | Static + files | `public/brand/*.svg`, `data/company.ts` | D30, M16 |

## 4. Content hubs

All entries from the public sitemap are present as **titles** with placeholder bodies, so these are **Partial**.

| URL | Entries | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|---|
| `/blog` + `/blog/<slug>` | 459 | Partial (titles real, bodies placeholder; search + pagination work) | Generated + Placeholder | `data/hubs.generated.ts`, `HubList.tsx`, `Hub.tsx` | D20, D21, M12 |
| `/engineering` + detail | 24 | Partial | Generated + Placeholder | same | – |
| `/clauses` + detail | 52 (7 categories, filterable) | Partial | Generated + Placeholder | same | D22 |
| `/topics` + detail | 10 | Partial | Generated + Placeholder | same | – |
| `/playbooks` + detail | 4 | Partial | Generated + Placeholder | same | – |

Detail pages show a stand-in article with previous/next links and related entries.

## 5. Legal and policy pages

Structure (section headings and order) follows the public pages; every paragraph is original placeholder text with a visible "recreated placeholder" notice. All **Partial**, data kind **Placeholder**, file `data/legal.ts`, rendered by `LegalView.tsx`.

| URL | Sections | Shots |
|---|---|---|
| `/privacy` | 15 (with subsections) | D23, M13 |
| `/terms` | 30 | – |
| `/dpa` | 5 | – |
| `/sla` | 5 | – |
| `/cookies` | 9 | – |
| `/refund-policy` | 12 | – |
| `/delete-data` (+ Mocked form) | 11 | – |
| `/security` (+ placeholder table) | 11 | D24, M19 |
| `/security/vulnerability-disclosure` | outline page via `data/extraPages.ts` | D18 |
| `/accessibility` | 9 | – |

## 6. Documentation (`/docs/...`)

> Shell and sidebar rebuilt 2026-10-20 to match the public docs layout (9 sidebar groups, 43 links, announcement bar, tab row, "On this page" rail). See `docs/DOCS-SHELL.md`. The page counts in the table below predate that change and the sidebar now links the 10 recipes and every concept page listed there.

| Part | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|
| Docs home `/docs` | Full | Static | `data/docs/nav.ts` | D12, M04 |
| Chrome: top bar, 4 tabs, sidebar (11 sections, 58 entries), ⌘/Ctrl-K title search, previous/next, on-this-page | Full | Static | `DocsShell.tsx` | D12 |
| 33 guide/concept/recipe pages | Partial (original explanatory text; observed structure and terms) | Placeholder | `data/docs/pages.ts` | D13, D25, D26, M14 |
| `/docs/api-reference` + 12 endpoint pages + India pricing page | Partial (illustrative parameters and a mock record) | Static | `data/endpoints.ts`, `[...slug]/page.tsx` | D27, D28, M15 |
| `/docs/integrations` | Partial (headings + placeholder) | Placeholder | `data/docs/pages.ts` | D29 |
| `/docs/introduction`, `/docs/guides/mcp-client` | Alias of API Overview (as on the public site) | Placeholder | `data/docs/pages.ts` (`docAliases`) | – |
| `/docs/llms.txt` | Full (plain-text index generated from the sidebar) | Static | `docs/llms.txt/route.ts` | – |

## 7. Sign-in shells

| URL | Completeness | Data kind | Files | Shots |
|---|---|---|---|---|
| `/auth/login` | **Shell** + Mocked form | Mock API | `/api/mock/forms/login` | D11, M05 |
| `/auth/signup` | Shell + Mocked form | Mock API | `/api/mock/forms/signup` | – |
| `/auth/forgot-password` | Shell + Mocked form | Mock API | `/api/mock/forms/login` | – |

## 8. Shared parts on every page

| Part | Data | Files |
|---|---|---|
| Top banner "local build · MOCKED" | Hardcoded | `(site)/layout.tsx` |
| Navigation (Pricing, Open Data, Docs, community icon, Sign in, Get API key) | Static | `Nav.tsx`, `data/site.ts` |
| Footer (3 link groups, extra quick links, newsletter) | Static + Mock API (`/api/mock/subscribe`) | `SiteFooter.tsx`, `data/site.ts` |
| "Data source" strip | Hardcoded | `ui.tsx` (`DataNote`) |

## 9. Utility routes

| URL | What it is |
|---|---|
| any unknown URL | Branded 404 (`src/app/not-found.tsx`) |
| render failure | Branded error page with Try again (`src/app/error.tsx`) |
| `/favicon.ico` | 308 redirect to `/icon.svg` |

The skip-to-content link (first Tab stop) is in `src/app/layout.tsx`; every page's `<main>` has `id="main"`.

## 10. Not recreated

| Item | Why |
|---|---|
| Real customer story page (a real person's story) | Replaced by one fictional story |
| Logos/downloads of the real brand (PNG/WebP files) | Not copied; original SVG logos are provided instead |
| Real article, clause, engineering, topic and playbook **bodies** | Titles only; not copied |
| Full text of docs and legal pages | Original summaries/structure only |
| The app behind sign-in, the real API, the real MCP server, any add-in | Not public; not recreated |
