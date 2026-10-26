# Reskin plan: LexBharat to the look of mrharit/Lex-bharat

**Status: audit and plan only. Nothing in `vaquill-local` was changed for this document (docs only, on `main`). No `reskin` branch exists yet.**
Audited 2026-10-26 from a read-only shallow clone at `../lex-bharat-design` (commit `f10c21c`, 2026-10-25, "New logo: pilcrow with trace line"). The clone is untouched (`git status` clean; no `npm install` was run in it, so **I have not seen the design rendered**; everything below is read from its code, README and content files).

## 0. The three things to know first

1. **The repo is a marketing website, not an app design.** It is "LexBharat website: governed legal AI for enterprise legal teams in India, sold as a consulting-style engagement": one long home page plus `/contact`, `/security`, `/privacy`, `/terms` and a 404. It has **no** Browse/Acts/Judgments, Chat, Drafting, Review, Vault, dashboard, sidebar, admin or login screens. Its product screens are illustrative mock-ups ("sample data") of an enterprise product that is not ours. So the reskin is: **take its visual language (palette, type, shapes, the "marked page" idea) and apply it to our screens; take its screens only for our marketing pages.**
2. **There is no licence file.** No `LICENSE`, and `package.json` is `private`. Without a licence the code is "all rights reserved" by default. If you (or your organisation) own `mrharit/Lex-bharat`, say so and nothing changes; otherwise we need written permission before copying code (colour values and font names are fine to reuse as design facts; their CSS, components and the logo geometry are copyrightable code/art). **Blocker B1.**
3. **Their stack is newer than ours** (Next 16, Tailwind 4, React 19.3 vs our Next 15.5, Tailwind 3.4, React 19.1). We should port the *values*, not upgrade the framework (section 1, decision D1).

## 1. Their stack, fonts, palette, scale, icons, licence

| | Design repo | Ours today |
|---|---|---|
| Framework | Next.js 16 App Router, TypeScript, statically generated; only server code is the contact-form action | Next.js 15.5.28 App Router, dynamic routes, Neon / Supabase / model APIs |
| React | 19.3 | 19.1 |
| Styling | **Tailwind CSS 4** (`@import "tailwindcss"`, `@theme inline`, `@layer components`), one 2,270-line `app/globals.css`; component classes (`.btn`, `.chip`, `.cite`, `.card`, `.eyebrow`, `.paper`, `.hl`, `.frame-glass`, `.surface-glow`, `.has-guides`) | Tailwind 3.4.19; one token file `src/styles/tokens.css` (RGB channels) mapped in `tailwind.config.ts`; shared kit in `src/components/kit` |
| Components | Hand-written (no component library); `lucide-react` icons; `zod` for the form | Hand-written kit (Badge, Notice, Panel, Highlight, RepealedNote, CitationChip) + shells |
| Fonts | **Source Serif 4** (headings, self-hosted, weight 400 with optical-size axis, SIL OFL), **Geist** 400/500 (all reading text and UI), **Geist Mono** 400/500 (small uppercase labels, captions), **IBM Plex Sans Devanagari** (loaded only when Hindi text nears the viewport) | Schibsted Grotesk (text), Source Code Pro (mono), Newsreader (serif), via `next/font/google` |
| Icons | `lucide-react` (1.5 stroke) | mostly inline SVG / text glyphs |
| Motion | CSS scroll-driven animations (titles fill word by word, pinned manifesto), a halftone "scan resolves" hero, `<Reveal>` fade-ups; all honour reduced motion and degrade to final states | minimal |
| Licence | **none stated** (fonts are OFL; icons ISC) | n/a |

**Palette** ("the marked page, on green"; light by default, one darker ground called the *glow*):

| Role | Value | Notes |
|---|---|---|
| paper (page) | `#f4f5ef` | faintly green; ours `#f2f1ee` (warm grey) |
| paper-2 (alt band) | `#e6ebe1` | ours "raised" `#eae9e5` |
| card | `#ffffff` | same as our surface |
| ink / ink-2 / muted | `#0f1f1a` / `#2f4439` / `#55665d` | ours `#25211d` / `#535151` / `#615950` |
| line | `#d2d9cc` | **1.3:1 on paper: decorative only** (see section 6) |
| accent (brand, buttons) | forest `#1f4d3a` (white on it 9.6:1) | ours burgundy `#6e3730` |
| tint / rule / handle | `#e3ede4` / `#4e7f63` / `#1f4d3a` | |
| attention (ochre) / verified / discarded | `#8a6a1f` / `#257548` / `#8a2e2a` | "the only red"; verified always carries a check or the word |
| glow ground | `#1f4a3a` base with grainy olive/ochre/forest gradient, white-alpha text, white pill buttons; `public/grain.webp` | marketing bands only |
| shadows | card: `0 1px 2px / 0 16px 34px -20px` ink at 5% / 22%; lift: `0 30px 60px -26px` | |

**Scale.** Radii: `4 / 6 / 10 / 14 / 18 / 24`; cards 16–18, controls 10–12, **buttons and chips are pills (999px)**. Type: body **17px** (1.0625rem, line-height 1.6), headings `clamp(2rem, 4.2vw, 3.5rem)` serif, eyebrow = small uppercase mono led by a pilcrow ("¶ 01 · WHY LEXBHARAT"). Layout: `.wrap` container, `.section` padding 7.5rem on desktop, `scroll-padding-top` 84px for a floating dark nav pill. Our workspace scale is 12–16px (28px titles) in 2–12px radii, so the two scales differ a lot (decision D2).

**Brand.** New logo: pilcrow with a trace line, "Lex" regular + "Bharat" bold in Source Serif 4, drawn as outlines from generated geometry (`lib/brand.ts`, made from a PDF kept outside the repo).

## 2. Screens in the design and where they land

| Design screen / piece | What it is | Our page(s) | Action |
|---|---|---|---|
| Floating dark nav pill, main button inside, mobile sheet (Esc closes, focus returns) | marketing nav | `src/components/Nav.tsx` (public site) | restyle (phase 3) |
| Footer (tagline, disclaimer "not legal advice", "Product screens show sample data") | | `SiteFooter.tsx` | restyle; keep our attribution and disclaimers |
| Hero "Orbit": 6 product tiles (9 on phones), halftone resolve, one button | home hero | `(site)/page.tsx` + `Hero.tsx` | restyle layout/type/colour only; **tiles must show OUR real products, not theirs** (D5) |
| Manifesto (pinned, 3 points) | statement | `HomeClosing.tsx` / home | optional, phase 5 |
| Why grid, Use cases (list + detail panel), Governance, Compare table, How we work, FAQ, Join card | marketing sections | `Proof.tsx`, `PricingFaq.tsx`, `HomeClosing.tsx`, `(site)/for-lawyers`, `customer`, `use-case/*`, `white-label`, `partners` | restyle shared section components (`StructuredPage`, `Hub`, `HubList`) once; copy stays ours |
| Product tabs (7 mock-ups: Assistant, Research, Tabular review, Draft, Vault, Workflows, Control room) | product demo | `(site)/playground`, home product band | **restyle only; do not import their mock-ups** (they depict features we do not have, section 4) |
| Provenance demo + **"marked page"** (cited paragraph lifted to white with a forest outline, surrounding lines dim to 80%) | the signature device | judgment reader, Chat source rows, Review citations | **map to our citation UI** (section 5): the best fit in the whole design |
| Team grid, Workspace board | photos / matter board | none | not used |
| `/contact` discovery form (zod, honeypot, rate limit) | form | `(site)/contact`, `support` | restyle fields; keep our existing form handling |
| `/security`, `/privacy`, `/terms`, 404 | supporting pages with glow header (`PageShell`) | `(site)/security`, `[legal]`, `not-found` | restyle with `PageShell`-like header |

### Our pages mapped to a design source

| Our page / component | Design source | Notes |
|---|---|---|
| Product switcher (`console/TopBar.tsx`), country picker | none | style from tokens + pill language |
| Sidebar (`workspace/WorkspaceNav.tsx`, `ConsoleShell.tsx`), mobile menu | nearest: nav pill + mobile sheet | design has no sidebar: new component, same tokens |
| Workspace dashboard (`WorkspaceDashboard.tsx`) | card + eyebrow language | no design |
| Browse Laws & Judgments (`BrowseLaws.tsx`), Acts list, Act page (`ActTextView.tsx`), schedule tables | cards, chips, eyebrows, "marked page" for the selected section | no design |
| SC / HC court pages, `CaseList`, `CaseRow`, case page, **judgment reader** (`JudgmentReader.tsx`) | "marked page" for matches and the active passage | no design |
| Search (`SearchField`, `SectionSearchResults`, `JudgmentTextSearch`, scope toggles) | `.btn`, `.chip`, `.cite` | no design |
| Chat (`ChatApp`, `AnswerView`, `CitationChip`) | Assistant mock-up (visual language only), `.cite` chips | no design for the real thing |
| Drafting (home, form, TipTap editor, panels), Review (home, run view), Vault | Draft / Tabular / Vault mock-ups for look only | no design |
| Password page (`access/page.tsx`, `AccessForm`), testing banner (`AccessDevBanner`), auth pages | `PageShell` glow header; form fields | restyle; wording stays |
| Admin insights, Developer console, Playground, Docs shell | none | 22 + 15 + 11 hard-coded hex values live here today: tokenise first |
| ~40 other public-site pages (`(site)/*`, `blog`, `clauses`, `topics`...) | marketing section components | restyle through shared components, not page by page |

## 3. Gaps both ways

**Our screens with no design (proposal: derive, do not invent).** Everything under `/workspace`, `/admin`, `/developer`, `/docs`, auth and the access page. Proposal: treat the design as a **token set plus six devices** and apply it to the app consistently:
1. forest accent, green-tinted paper, white cards (colour tokens); 2. serif for page titles only, Geist for UI and reading, Geist Mono for small uppercase labels with the pilcrow (`¶`) kicker; 3. pill buttons and chips, 10–16px card radii; 4. the *marked page* for every "this is the cited / matched passage" moment; 5. the three status colours with icon-or-word (never colour alone); 6. **no glow/grain/scroll animation inside the workspace** (readability, performance, battery); glow only on marketing headers and the password page.
The app keeps its compact type scale (D2).

**Design screens with no backend (will not be built; marketing copy for them must not appear):**
- Enterprise "Matter" workspace board, Control Room (calls today, spend, quotas by user/matter/BU), hash-chained audit log, entity-level access scoping, masking gateway, "24/7 review agent".
- Tabular review grid with confidence routing and Excel export; playbook comparison; "contrary authority" research with "Distinguished in" relations; Hindi recognition with a correction pass as a product claim.
- Discovery-call booking and the "four-week engagement" story, pricing blocks, team photos, client/industry framing.
- Our real equivalents (Acts/Judgments search, Chat with source check, Drafting, Review, Vault, judgment reader) have no mock-up in the design, so their *layouts* are ours.

## 4. Phased plan (new branch `reskin`, never on `main`)

Working rule for every phase: no change to `src/lib/**`, `src/app/api/**`, SQL, scripts or config JSON. Allowed paths: `src/styles/`, `tailwind.config.ts`, `src/components/**`, `src/app/**/page.tsx|layout.tsx` (markup/classes only), `public/`. A phase is merged only when all checks pass.

**Checks for every phase (the "no functional change" gate):**
1. `npm run test:extract`, `npm run qa:sweep`, `npm run build` all pass.
2. `git diff main --stat -- src/lib src/app/api scripts` is **empty** (CI-style guard; if it is not empty the phase is rejected).
3. Screenshot comparison: before/after of a fixed list (home, browse, Act page, SC court page, case page expanded, judgment reader, search results, chat answer, drafting editor, review run, vault, access page) at 1280 and 375 px, plus dark-banner and error states; differences reviewed by you, not auto-accepted.
4. Computed-style probe: font size / colour / radius / overflow per page at 375 and 1280 (the method already used in W9/W10), `scrollWidth == innerWidth`.
5. Full feature pass (existing `scripts/w9/final-check.mjs` + `scripts/w10/w10-check.mjs` + one Review end to end + one Chat with judgment chip + HC list + Hindi search + regulator search).
6. Accessibility: axe on the same pages; contrast table regenerated from tokens; keyboard walk of nav, search, reader.

| Phase | Work | Files touched (approx.) | Risk | Extra check |
|---|---|---|---|---|
| **0. Prep** | Branch `reskin`; resolve B1 (licence); decide D1–D5; freeze screenshots of the current site as the baseline set | none | none | baseline images committed outside the repo |
| **1. Tokens** | Move all remaining hard-coded values to `tokens.css`: 489 `text-[Npx]` uses in 57 files, ~108 hex values in 20 files (DeveloperConsole 22, docs page 15, DocsShell 11, PlaygroundApp 10, Proof 8, SearchField 4...). **No visual change yet** (values identical). Then add the new palette as a second token set (`[data-theme="reskin"]`), default off | `tokens.css`, `tailwind.config.ts`, ~57 component/page files (class names only) | medium (many small edits) but mechanical; **zero pixel change is the acceptance test** | pixel diff must be empty before the new theme is switched on |
| **2. Fonts and shared kit** | Load Geist / Geist Mono / Source Serif 4 (self-host) / Plex Devanagari (lazy) in `layout.tsx`; restyle `kit/*` (Badge, Notice, Panel, Highlight, CitationChip, RepealedNote) and add missing shared parts: **Button (primary/ghost/pill), Chip, Eyebrow, Card, FormField, marked-page highlight, SectionHead**. Replace per-page button/field styling with the kit | `src/app/layout.tsx`, `src/components/kit/*`, `ui.tsx`, `SearchField.tsx`, 20-30 call sites | medium: shapes change everywhere at once, but only through tokens | contrast table; keyboard focus ring visible on paper and on the dark nav; font fallbacks (Devanagari) |
| **3. Shell** | Console top bar + product switcher, sidebar, mobile drawer, dev/testing banner, password page, auth pages; public nav pill, footer | `TopBar`, `ConsoleShell`, `WorkspaceNav`, `AccessDevBanner`, `AccessForm`, `Nav`, `SiteFooter`, auth pages | **highest** (every page uses it; focus order, drawer, 375 px) | keyboard walk (Tab, Esc closes drawer, focus returns), skip link, banner still visible and unchanged in wording, gate redirect unchanged |
| **4a. Browse / Acts / judgments** | Browse, Acts list and page, schedule tables, courts, case list/page, search results, **judgment reader** (marked-page highlight for the active match and for `#passage` targets) | `workspace/*` (BrowseLaws, ActTextView, CaseList, CaseRow, Search*, JudgmentReader, JudgmentFullText...) | medium (dense tables; long text pages) | reader: first 20 paragraphs, expand, search, Cmd+F, copy, print at 375 and 1280; honesty labels present |
| **4b. Chat / Drafting / Review / Vault** | answer view, source rows and chips (act / document / judgment), editor chrome (TipTap), review run view, vault list and doc view | `workspace/chat,drafting,review,vault`, `kit` | medium (editor and streaming UI) | full feature pass; export .docx/.pdf; judgment chip still distinct from act and document chips |
| **4c. Admin / developer / docs / playground** | tokenised pages restyled | `console/*`, `docs/*`, `(docs)`, `admin` | low (internal) | smoke only |
| **5. Public marketing pages** | home hero/sections, `StructuredPage`, `Hub`, contact, security, legal, 404 with a glow header; optional manifesto and scroll titles; **our** product tiles | `(site)/*`, `Hero`, `Proof`, `HomeClosing`... | medium; motion must respect reduced motion | Lighthouse mobile >= 90 on home; reduced-motion pass; no horizontal overflow at 360/390/768/1024/1440 |
| **6. Hardening and merge** | contrast, axe, 375 px sweep, screenshots, bundle size (fonts), then PR `reskin` to `main` (your call; I will not push) | tests, docs | low | all gates above on the final branch |

## 5. How the design's best ideas map onto our product

- **Marked page** = our judgment reader's active match and `#passage-N` target, Chat/Review "source" rows, and the Act page's selected section: the cited text is lifted (white + forest outline), the rest dims to ~80%. Never colour alone (outline + handles).
- **Citation pill `.cite`** = our `CitationChip` (act / document / judgment variants keep distinct shapes: solid, dashed, neutral).
- **Status triad with icon-or-word** = our `Badge` tones for complete / possibly incomplete / garbled and the quality notices.
- **Pilcrow eyebrow** also suits "¶ 12" paragraph labels in the reader.
- **Provenance** (the design's whole argument) is what our honest labels already do: keep them prominent.

## 6. Conflicts with our rules, and how they are resolved

| Design behaviour | Conflict | Resolution |
|---|---|---|
| `--line` `#d2d9cc` is 1.3:1 on paper and 1.4:1 on white | WCAG 1.4.11 needs 3:1 for form-field and control outlines (we use a dedicated `--control-border` at 4.6:1) | keep a separate **control-border token** (green-grey, >= 4.5:1); use `line` only for decoration |
| Pill buttons, glow, grain, dim-to-80% on the marked page | dimmed text: 80% opacity of `ink-2` (9.5:1) stays > 4.5:1 on paper, but dimming **muted** text would not | dim only `ink`/`ink-2` text; re-measure after |
| Motion (scroll-driven titles, pinned sections, halftone) | fine for marketing, wrong for dense reading screens; reduced-motion and Firefox fallbacks exist | marketing pages only; workspace has none; honour `prefers-reduced-motion` |
| Dark floating nav pill with zero-height sticky header and 80px top padding | would cover our page headings and the testing banner; our sidebar layout differs | pill for public pages only; workspace keeps a normal top bar; banner sits above everything |
| "Sample data", fictional matters, "enterprise" claims, hash-chained audit, 24/7 agent, four-week build, pricing | **not true of our product**; our rule is honest provenance labels | no copy or mock-up is imported; `CLAIMS-TO-VERIFY.md` shows the design's own owner has these unsigned |
| Footer "provides software and services, not legal advice" | matches our rule | keep and add our data attribution (open-india-law, CC BY 4.0) and "not legal advice" notes unchanged |
| Body text 17px, 1.6 leading | our workspace is dense (14–15px) | two scales (D2): marketing = design scale; app = our scale in the new fonts |
| Geist weights 400/500 only | our UI uses bold in places | allow 600 via the variable font or re-map emphasis to 500 + colour; check headings |
| No cookies, no banner; Plausible analytics | we use Vercel Analytics and our own counters (cookie `lb_access`, browser id) | no change; design adds none |
| Password gate, testing banner, "mock" badges | absent in design | restyle only; text, placement and behaviour unchanged |
| Tailwind 4 syntax, `@layer components`, `:has()`, `color-mix()` | our build is Tailwind 3.4 | port values into our token file and our kit; do not copy their CSS file (also a licence matter) |
| Source Serif 4 at weight 400 only | bold "Bharat" in the wordmark uses outlines, not the font | logo needs its own asset (B2) |

## 7. Decisions needed and blockers

| # | Item | Recommendation |
|---|---|---|
| **B1** | Licence of the design repo (none stated) | confirm you own it or get permission before any code or logo is copied; until then reuse only the *values* (hex, sizes, font names) |
| **B2** | Logo: new pilcrow mark and wordmark come from a PDF outside the repo and generated outlines | need the PDF/SVG from the design owner; otherwise keep the current logo in phase 3 |
| **B3** | I have not seen it rendered (no install in the clone) | send the deployed URL or screenshots, or allow `npm install` in a **copy** of the clone, so I can compare colours and spacing visually in phase 0 |
| D1 | Tailwind 4 / Next 16 | **stay on Tailwind 3.4 and Next 15.5**; port tokens. An upgrade would be its own project (border/ring/shadow defaults change, 489 arbitrary classes to retest) |
| D2 | Type scale | two density scales: public pages use the design scale; workspace keeps 14–15px in Geist |
| D3 | Dark mode | the design has none (the glow is a band, not a theme); do not add one |
| D4 | Hero tiles and product band | use screenshots of our real screens, never their mock-ups |
| D5 | Scope of motion | marketing pages only, reduced-motion safe |
| D6 | Hindi | adopt IBM Plex Sans Devanagari (lazy) for the Hindi sections we show |

## 8. Effort and order (estimate, assuming B1 and B3 are settled)

Phase 1 is the longest by volume (mechanical, ~80 files); phases 2–3 are the riskiest; 4a/4b can run as separate sessions after 3. I would do phase 0 and 1 first, because phase 1 can be done and merged on its own with zero visual change and makes every later phase a token edit. Nothing starts until you approve this plan and answer B1–B3.


---
# Update 2026-10-26: decisions, Phase 0 and Phase 1 (branch `reskin`)

## Decisions from the owner
- **B1 (licence):** the owner of `mrharit/Lex-bharat` says we may reuse its code, styles and logo in LexBharat. (Recorded as the owner's statement; no licence file was added to that repo.)
- **B2 (logo):** use "LB" as the logo for now. Phase 3 will build a simple LB mark from tokens; the pilcrow logo is not used yet.
- **B3 (rendering):** done. `npm install` ran in the clone only; the design was run locally (port 3200) and photographed at 1280 px and 375 px: `docs/screenshots/reskin-design/` (home, security, contact, terms). The home page is 17,000 px tall at desktop and 25,000 px on a phone. What the screenshots confirm: forest-green glow header with grain and white guide lines, dark floating nav pill with a white button, serif headings, mono uppercase kickers with the pilcrow, pale-green footer with a large serif tagline. Everything in section 1 of this plan matches.
- **Public pages without the password:** home, privacy, terms, security, contact (and the other public marketing pages) must open without the password; the app (`/workspace`, `/admin`, `/developer`...) stays behind the gate. This changes `src/middleware.ts` and `src/lib/access/` (today every page needs the password except `/access`), so it belongs to **Phase 5**, not Phase 1, with its own tests (the gate tests in `token.test.mjs` plus a route-by-route check that no app or API route became public).
- **Privacy, Terms and Security pages** will be written from what LexBharat actually does, never copied from the design (the design's text describes an enterprise product with masking, hash-chained audit and a hosted/self-hosted model that we do not have). Facts to state, to be checked by a lawyer before launch: it is a **testing phase**; **not legal advice**; data is stored in Neon Postgres (Acts, chats, drafts, regulator and judgment text/vectors, five projects), Supabase (Vault files and text, feedback, usage counters, rate limits), Vercel (hosting, analytics); questions, Vault passages and drafts are sent to the AI providers we use (Google Gemini for answers/drafting/review/scan reading, Voyage AI for embeddings); the browser id cookie and access cookie; no accounts; what is logged (usage counters, feedback); the sources and licences of the legal data (open-india-law CC BY 4.0, India Code); deletion and contact route. This list will be re-derived from the code at Phase 5 so it cannot drift.

## Phase 0: done
Branch `reskin` created from `main` (`main` untouched). Tools for the no-change proof live in `qa/reskin/` (not `scripts/`): `cdp.mjs` (headless Chrome driver), `snap.mjs` (snapshots 41 pages at 1280 and 375 px: a whole-page PNG plus the computed style and box of every element), `compare.mjs` (computed-style and pixel comparison, threshold 0), `tokenise.mjs` (the Phase 1 codemod). Pages: home and 15 public pages, docs, developer, auth, 404, the password page, workspace, browse (judgments and Acts tabs), Act pages (NI Act, section 138, Constitution Article 21, a regulator instrument), SC and HC court and year pages, a short and a long case page, chat, drafting, review, vault, admin. Snapshots are taken from a production build with throwaway passwords and animations frozen. **Repeatability proved first:** two snapshots of the unchanged code are identical in all 82 page/width pairs (0 style differences, 0 pixels). (Without freezing, only the home page's moving testimonial strip differed.) Not covered by snapshots: interaction states (open menus, hover, focus, streaming answers, the editor while typing) and the admin page behind its login (the snapshot shows its login form); the full feature pass covers behaviour.

## Phase 1: done, no pixel changed
What moved into `src/styles/tokens.css` (and `tailwind.config.ts`), always with the identical value:
| Kind | Replaced | Notes |
|---|---:|---|
| Font sizes `text-[Npx]` | 502 | to `text-fs-N` (existing names kept: micro 10, nano 11, xs 12, sm 13, ui 14, body 15, lead 16, xl 18, display 24, title 28); 18 new sizes added (12.5, 17, 20, 21, 22, 26, 30, 32, 34, 36, 38, 40, 44, 46, 48, 56, 64, 72) |
| Colours `text/bg/border-[#hex]` | 88 | 5 matched existing tokens (secondary, ink, primary, primary-hover, dark); 4 got a role name (subtle, strong, soft, danger); 18 are `legacy-<hex>` until the reskin gives them a role |
| Inline colours in code (Nav logo, coverage map, testimonials, `globals.css`) | 17 | to `rgb(var(--token-rgb))` / `var(--primary)`; two soft gradients use new `--primary-glow-strong/soft` tokens (hex with alpha, exact) |
| Radius `rounded-[Npx]` | 46 | tight, panel, field, control, new `slim` (3 px) |
| Letter spacing, line height | 51 + 9 | existing tokens plus 5 + 4 new |
| Max widths `max-w-[Npx]` | 75 | `max-w-content` (880) and 21 new `max-w-wNNN` tokens |
| Shadow, `white` | 1 + 33 | `shadow-pop`; Tailwind's `white` now reads `--white-rgb` |
Touched: 75 files (70 components/pages for class names, `globals.css`, `tailwind.config.ts`, `tokens.css`, 4 components with inline colours). Result: **0** `text-[Npx]`, `rounded-[`, `tracking-[`, `leading-[`, `max-w-[Npx]`, colour-hex classes or inline hex left in `src/components` and `src/app` (apart from one code comment).
Left on purpose (not colour/type/radius): layout dimensions such as `w-[...]`, `h-[...]`, `grid-cols-[...]`, percentages and `ch` widths; the palette *listing* in `src/data/company.ts` and the Brand page (documentation of the colours, shown as text); `bg-[var(--code-bg)]`-style classes that already read a token. These will be tidied in Phase 2 together with the kit.

### Proof
| Gate | Result |
|---|---|
| Computed styles + pixels, 41 pages x 2 widths, baseline vs after | **PASS: 82 of 82 identical, 0 style differences, 0 pixels** |
| Baseline repeatability (same code twice) | 82 of 82 identical |
| `npm run test:extract` | 194 of 194 pass |
| `npm run qa:sweep`, `npm run build` | pass |
| `git diff main -- src/lib src/app/api scripts` | **empty** |
Two things the proof caught on the way: a gradient written as `rgb(var(--primary-rgb)/0.333)` differed by one colour level in 7,263 pixels from the original hex alpha `#6e373055`, so the alpha stayed a hex token; and the home page's moving testimonial strip made the baseline unrepeatable until animations were frozen in the snapshot.

**Stopped before Phase 2**, as instructed.


---
# Update: Phase 2 (fonts and shared components), branch `reskin`

Phase 1 (87dbbec) was merged into `main` first (fast-forward; tests, qa:sweep and build re-run on `main`: 194/194, pass, pass). Phase 2 lives only on `reskin`.

## What changed
- **Fonts (all free, OFL):** Geist (text and UI, 400/500/600), Geist Mono (labels, code), Source Serif 4 (headings; self-hosted weight 400 with its optical-size axis, copied from the design repo), IBM Plex Sans Devanagari (not preloaded; the browser fetches it only when a page shows Devanagari text, via `unicode-range`). Workspace page titles (`.console h1`) use the serif.
- **Palette** (`src/styles/tokens.css`, one file): green paper `#f4f5ef`, cards white, ink `#0f1f1a`, muted `#55665d`, forest brand `#1f4d3a` (hover `#163a2b`), accent tint `#e3ede4`, success `#257548`, warning `#765810`, error `#8a2e2a`. **Control outlines use a separate `control-border` token `#5e6d64`** (5.5:1 on white, 5.0:1 on the page; the decorative `border` hairline is 1.4:1 and is not used for controls).
- **Shapes:** buttons, toggles and chips are pills; inputs 12 px; cards 16 px; panels 10 px.
- **Type scale kept:** workspace UI stays 14-15 px. Reading text (judgment reader, Act section text) is Geist 17 px (`text-reading`, token `--text-reading`). The design's 17 px scale for the *public pages* is Phase 5 (those pages still use their current sizes in the new fonts and colours).
- **Shared kit** (`src/components/kit/`, tokens only): new `Button` (primary / secondary / ghost / quiet, sm/md/lg, link or button), `Toggle` (pill option group), `Eyebrow` (mono pilcrow label), `MarkedPage` and `MarkedScope`, class helpers in `controls.ts` (`buttonClass`, `fieldClass`, `selectClass`, `toggleClass`); restyled `Badge`, `CitationChip` (mono pill; act, document and judgment variants stay distinct), `Notice`, `Panel`, `SearchField` (pill search bar), selects, the Previous/Next buttons, scope and mode toggles, judgment reader controls.
- **Role-based shape codemods** (`qa/reskin/phase2-codemod.mjs`, `...2.mjs`): ~100 buttons, inputs, cards and chips across 59 files got the new radius and the control outline token by role (class strings only).
- **The marked page** (`.marked`, `.marked-scope` in `globals.css`; component `MarkedPage`): the passage is lifted to white with a forest outline and two corner handles; in a scope the surrounding blocks dim to 80% (never in print, where it becomes an outline). Used first on the **selected Act section** (its text) and on the **judgment passage a citation or search result points at** (`#passage-N`, the reader dims the other passages).
- Small a11y fixes found by axe: scrollable code blocks got `tabIndex=0`; the drafting placeholder highlight now sets its own text colour; one testimonial avatar tint was darkened.

## Checks
| Gate | Result |
|---|---|
| `git diff main -- src/lib src/app/api scripts` | **empty** |
| `npm run test:extract` | 194 of 194 |
| `npm run qa:sweep`, `npm run build` | pass |
| Contrast of the token pairs in use (`node qa/reskin/contrast.mjs`) | **PASS**: every text pair >= 4.5:1 on surface, page, raised and accent; status badges on their tints >= 4.5:1; control-border >= 4.5:1 |
| axe-core WCAG 2.0/2.1/2.2 A+AA, 12 screens x 1280 and 375 px | **0 violations** (after fixing 4 it found) |
| Feature pass: `scripts/w9/final-check.mjs` | 56 of 57; the one failure is "smart (meaning) search" |
| `scripts/w10/w10-check.mjs` | 16 of 17; the one failure is "search inside judgments by meaning" |
Both failures are the free Voyage limit (3 requests a minute): the checks fire several searches by meaning in a row, the search falls back to keywords (`semantic_error`) and the assertion on "by meaning" fails. Re-run alone a minute later, both pass (Limitation Act sections first for the specific-performance question; a Supreme Court judgment for the cheque question). No other check failed, including login/gate, Browse, Act pages, Vault, Chat with a judgment chip, Drafting (5 templates, .docx and PDF), Review end to end, feedback and admin.

## Screenshots (before = `main`, after = `reskin`, same fixture data)
`docs/screenshots/reskin-phase2/<screen>-<1280|375>-<before|after>.png` for: `01-dashboard`, `02-chat-answer`, `03-act-selected-section`, `04-sc-judgment`, `05-drafting-editor`, `06-review-result`, `07-vault-list` (28 pairs). The data (a chat answer with citations, a draft, a Vault document, a Review) is created once under a fixed test browser id by `qa/reskin/fixtures.mjs`; shots by `qa/reskin/screens.mjs`.

## Known and left for later phases
Shell (top bar, sidebar, drawer, banner, password page) is only re-coloured and re-fonted, not restructured (Phase 3). The feedback thumbs, the chat composer and some ad-hoc controls still carry their old structure with the new colours. Public marketing pages keep their layout, not the design's (Phase 5). Layout dimensions (`w-[...]`, `h-[...]`) and the brand palette listing remain as noted in Phase 1.

**Stopped before Phase 3.**
