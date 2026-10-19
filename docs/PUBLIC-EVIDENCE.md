# What was observed on the real public site

The reference was a public US-primary-law API company's marketing and documentation site. This file records **only what a normal visitor's browser receives**. The recreation here is branded LexBharat and does not reuse the original's logo, text or assets.

## What was accessed, and what was not

| Accessed (public GET requests) | Not accessed |
|---|---|
| Home page, loaded once in a headless browser (82 requests recorded) | Anything behind a login |
| `robots.txt` and `sitemap.xml` | `/api/`, `/_next/` internals and `/private/` (all disallowed by `robots.txt`) |
| 86 public pages as **text outlines only** (headings, short text, link targets): all top-level marketing pages, 9 legal pages, the Word add-in pages, the ethics, security-disclosure and use-case pages, the blog/clauses/engineering/topics/playbooks **listing pages**, and 47 docs pages | Article, clause, engineering, topic and playbook **detail** pages (only titles from listings and the sitemap were used) |
| The public sign-in and sign-up pages (viewed only; nothing entered) | Form submissions, key creation, any account action |
| The `/slack` address (one request, to see where it goes) | The product API, the dashboard, any private or hidden endpoint |
| The public `llms.txt` docs index (first lines read) | Brand-download files (their addresses were noted, not fetched) |

## Site structure (from the public sitemap)

585 URLs: 460 blog posts, 53 contract-clause pages, 25 engineering articles, 11 topic pages, 5 playbooks, plus ~30 top-level pages. This build recreates every top-level page and lists **every** blog, clause, engineering, topic and playbook title (459 / 52 / 24 / 10 / 4 detail pages plus their index pages).

Public links found on the pages but **not** in the sitemap, now recreated: `/word`, `/word/sideload`, `/slack` (see below), `/docs/*` pages, `/docs/integrations`, `/docs/introduction`, `/docs/guides/mcp-client`, `/docs/api-guide/coverage/india`, API-reference pages, and the India API-reference pricing page.

## The `/slack` address

The real `/slack` has no page of its own: the server answers with an **HTTP 307 temporary redirect** to an external chat-service invitation link. A local build cannot sensibly redirect to someone else's workspace, so `/slack` here is a **redirect shell** page explaining what the real link does, with an inert button.

## Technology evidence (home page)

| Finding | Evidence | Confidence |
|---|---|---|
| Built with **Next.js** (App Router) | `x-nextjs-prerender` header, `/_next/static/` assets, `?_rsc=` prefetch requests, `__next_f` global | Verified |
| Hosted on **Vercel** | `server: Vercel`, `x-vercel-id`, `x-vercel-cache: HIT` | Verified |
| Page is pre-rendered (static) | Cache hit, no first-party data requests on load | Verified |
| **Tailwind-style** utility CSS | Class names such as `px-4 sm:px-6`, `bg-accent/50` | Strong inference |
| Smooth scroll via **Lenis** | `lenis` class on `<html>`, `lenis` global | Verified |
| Code snippets highlighted with a syntax highlighter (Shiki) | String occurrences in the page | Strong inference |
| Fonts: Schibsted Grotesk, Source Code Pro (+ an unidentified serif for large headings) | Computed styles / font files | Verified (serif unknown) |
| Docs are a separate documentation-platform site with an `llms.txt` index and a "copy page" feature | Page structure, `/docs/llms.txt` exists | Strong inference |

## Third-party services observed on the home page

| Service | Evidence |
|---|---|
| Google Tag Manager / Analytics / Ads conversion | Requests to `googletagmanager.com`, `analytics.google.com`, `doubleclick.net`; cookies `_ga*`, `_gcl_au` |
| PostHog (product analytics) | Requests to `us.i.posthog.com`; a PostHog cookie and localStorage key |
| Reddit pixel | `redditstatic.com` script, `alb.reddit.com` request, `_rdt_uuid` cookie |
| Facebook/Meta pixel | `connect.facebook.net` allowed in policy; `_fbp` cookie |
| Calendly | Booking link; allowed in policy |
| Vercel Web Vitals | `vitals.vercel-insights.com` allowed in policy |
| An embedded support/chat widget on a company subdomain | Allowed in the page's content-security policy; did not load in the capture |
| YouTube / LinkedIn embeds | Allowed frame sources in the policy |

**Not copied into this build:** none of these services are called here. The local build sets no tracking cookies.

## Requests on a home-page load (summary)

82 requests: 26 first-party scripts, 11 images, 5 fonts, 1 stylesheet, 1 manifest, 1 document, ~8 first-party `fetch` calls (all Next.js page prefetches to `/` and `/open-us-law`), and ~25 third-party analytics/ad calls (some aborted by the browser). **No first-party JSON API calls were made.** The numbers on the page are part of the pre-built HTML.

## Hosts named in public page content

Named on the pages themselves (not probed):

| Role | How it was described |
|---|---|
| REST API | An `api.` subdomain, e.g. `GET /api/v1/us/statutes/resolve` with a bearer-token header |
| Web app | An `app.` subdomain hosting sign-in, sign-up and the dashboard |
| Open data files | An object-store domain serving Parquet files (queried with DuckDB in the page's sample SQL) and an `index.json` manifest |
| Per-section HTML/PDF | A `statutes-` subdomain |
| MCP server and status page | `mcp.` and `status.` subdomains (from the service-levels page) |

## API endpoints and fields printed in public pages

The marketing page says "12 endpoints you will use most, of 29" and lists 12; those paths are in `src/data/endpoints.ts`. The public docs additionally name: `POST /us/statutes/search`, `/resolve` (GET and POST), `/divisions`, `/coverage`, `/laws`, `/count`, section sub-routes (`/body`, `/related`, `/changes`, `/cited-by`, `/definitions`, `/cross-state`, `/enactments`), session-law routes, watch routes (`/boards`, `/watches`, deliveries and diffs), plus parameters and values such as `corpusType` (USC, CFR, STATE, REGULATION, STATE_CONSTITUTION, STATE_RULES, FEDERAL_REGISTER, AGENCY_GUIDANCE, SESSION_LAW …), `state`, `source`, `asOf`, `changedSince`, `includeBody`, `limit`, `offset`, `hasMore`, `actId`, `actStatus`, `goodLawStatus`, and HTTP status meanings (400, 401, 402, 422, 429). These appear in the recreated docs as **documentation text**. They are not calls this project made.

Public claims about behavior (as displayed, not tested): Bluebook citation resolution, point-in-time reads, batch lookups, signed webhooks, per-source refresh schedules (CFR daily, US Code weekly, state regulations monthly), and an open dataset snapshot with hundreds of files.

## Public figures that appear in this build

Per-state statute-section counts (51 tiles), headline stats (5.4M+ sections, 56 jurisdictions), federal corpus counts, India counts and the "12 of 29 endpoints" figure were copied as **display numbers**. They are not computed here and not independently verified.

## What was deliberately not copied

Logos and downloadable brand files; real people's names and bios; the real customer story; testimonials; article, clause and playbook bodies and their one-line blurbs; legal, policy and docs wording; screenshots of social posts; the exact map geometry.
