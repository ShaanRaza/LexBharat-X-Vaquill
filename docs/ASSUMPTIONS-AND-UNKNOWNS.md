# Assumptions, unknowns and limits

Plain-English summary: the **front end** of the real site is largely knowable from the outside. The **backend, database and internal design are not**, and this project does not pretend otherwise. Where this build approximates something, it says so on the page.

## 1. Verified from public evidence

- The marketing site is a **Next.js** app on **Vercel**, with a pre-rendered home page (headers and asset paths).
- The home page makes **no first-party data API calls**; its numbers are baked in.
- Analytics and marketing tags from Google, PostHog, Reddit and Meta are present, with the cookies listed in [`PUBLIC-EVIDENCE.md`](PUBLIC-EVIDENCE.md).
- Design tokens: colors, radii, easing and the two fonts.
- The **structure** of the pages and docs: sections, nav, footer, sidebar tree, heading order, endpoint paths and field names as printed.
- `robots.txt` disallows `/api/`, `/_next/` and `/private/`; the sitemap lists 585 URLs.
- `/slack` answers with an HTTP 307 redirect to an external invitation link.
- Public claims such as "5.4M+ sections" or "refreshed daily" are **claims on the page**. Their presence is verified; their truth is not.

## 2. Strong inference (reasonable, not proven)

- **Tailwind CSS** is used (class-name patterns).
- The API and dashboard are separate applications on other subdomains (linked from the pages and allowed by the site's content policy).
- Law text is stored as **columnar files** in object storage (the page demonstrates querying Parquet over HTTPS).
- The docs run on a separate documentation platform (page structure, `llms.txt`).
- The footer email box posts to **some** service (it validates client-side).
- Customer logos and screenshots are static images shipped with the site.

## 3. Unknown / not possible to confirm from the public site

- **The database**: type, schema, size, hosting, backups. Public docs describe a data *schema* (fields like `actId`, `citation`), which is not the same as the database.
- **Backend language/framework**, queues, scraper schedules, search-engine internals, ranking, the vector index implementation.
- How API keys, credits, billing and rate limits are implemented.
- Where submitted email addresses go and how they are stored.
- Accuracy and completeness of the corpus; the "currency" of any section.
- The Word add-in's internals, the MCP server's implementation, and the real response bodies of any endpoint (nothing was called).
- The real wording of docs, legal pages and articles: **not copied**, so nothing here can be compared line-by-line.
- The display serif font in large headlines (Newsreader is a stand-in).

## 4. What is approximated (and how it is labeled)

| Area | Approximation | Label on the page |
|---|---|---|
| Legal pages (9) | Real section structure, original generic wording | Yellow "recreated placeholder" notice at the top; "(placeholder date)" |
| Docs (43 guide pages, 12 endpoint pages, integrations) | Original explanatory text built from observed terms; illustrative requests and one mock response record | "recreated" badges on reference pages; data-source strip |
| Content hubs | Titles only; generic summaries and article bodies | "titles only" and "recreated placeholder" badges |
| Ethics, vulnerability disclosure, use case, Word add-in | Headings observed; wording original | "recreated placeholder" badge |
| Customer story, founders, testimonial, comment cards | Entirely fictional | "fictional" / "placeholder" labels |
| Logos | Original leaf mark and SVG variants | "original placeholder artwork" |
| US map | Original tile grid with copied per-state counts | "original simplified layout" |
| Pricing | Plan structure and credit figures as displayed publicly | "placeholder plans"; nothing purchasable |

## 5. Choices made in this build

| Choice | Why |
|---|---|
| Rebranded to **LexBharat** with an original leaf mark | Avoid copying the original's brand assets |
| Fictional founders, customers, quotes | Do not reproduce real people's bios or testimonials |
| Legal pages contain placeholder wording | They are not usable legal documents |
| Hub titles kept, bodies and blurbs not | Titles work as labels; the content is the original's |
| External links (dataset hosting, code repository, add-in download, chat invite) are inert or local | Avoid pointing the local build at the original's services |
| Brand downloads are original SVGs | Do not copy the original's logo files |

## 6. Known quirks left as they are

- **Mobile hero highlight (fixed):** on phones the cycling phrase's highlight now wraps line by line. This was a class-only change in `src/components/Hero.tsx`; from 640 px wide upward the original single-box highlight is unchanged.
- **Dev warning in automated screenshots:** when a screenshot tool injects `caret-color: transparent` into inputs, React logs a hydration notice. It comes from the test tool, not the app; runs without screenshots show no console errors.
- The developer-console Playground clone (`/developer`) has its own confirmed / mocked / unknown breakdown: `docs/PLAYGROUND-BUILD.md` (sections 2, 3 and 5) and `playground-evidence.md`. Its response bodies (other than Pricing) are invented.
- `/api/mock/search` is not called by any screen (the Playground uses the same search function directly).
- `package.json` sets port 3100 and the Claude launch configuration also passes `--port 3100`; harmless duplication.
- The in-memory "database" resets on every server restart by design. In dev mode Next.js can also restart itself under heavy memory use (seen during a 582-page crawl); the Alerts list then returns to its sample entry.
- QA found and fixed 2 High, 7 Medium and 17 Low issues; open items that need a decision are listed in `qa/QA-REPORT.md` section 6 (dev annotations visible on every page, placeholder content, competitor names in 52 blog titles, production build not yet run, `npm audit` advisories).
- `npm audit` reports vulnerabilities in dev-time tooling (Tailwind 3's PostCSS chain). Not upgraded.
- Blog "categories" do not exist (the public listing shows none), so the blog filter box is search-only; clauses and playbooks have a category filter.
- `npm run build` was **not run** as part of verification (it would overwrite the folder the running dev server uses). The type-check passes and every page was fetched successfully from the dev server.

## 7. Boundaries respected

Public pages only; no logins or accounts; no private, hidden or `robots.txt`-disallowed paths; no form submissions to the real site; no attempt to recover or guess the real source code, backend or data; no copying of long passages, logos or personal profiles.
