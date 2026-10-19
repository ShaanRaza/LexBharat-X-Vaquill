# Docs shell: how it was matched to the public docs

Scope: the documentation area (`/docs/...`) of the LexBharat build, rebuilt on 2026-10-20 so its shell and left sidebar read as the same docs product as the public Vaquill docs, with LexBharat branding. The reference was the **public** API Coverage docs page, measured at a 1440 px viewport (computed positions, sizes, fonts and colours of the real DOM). Nothing behind a login was used. The page copy is original wording; headings, labels and structure follow the reference.

## Where it lives
| Part | File |
|---|---|
| Shell: announcement bar, header, tab row, sidebar, main column | `src/components/DocsShell.tsx` |
| Sidebar data (9 guide groups, icons, labels, order) and the other tabs' sidebars | `src/data/docs/nav.ts` (`guideNav`, `referenceNav`, `integrationsNav`, `indiaNav`) |
| Group icons | `src/components/docs/DocsIcons.tsx` |
| Page layout: eyebrow, title row, lead, body, footer, prev/next | `src/app/(docs)/docs/[...slug]/page.tsx` |
| "Copy page" split button | `src/components/docs/CopyPage.tsx` |
| Right "On this page" rail (scroll-spy) | `src/components/docs/DocsToc.tsx` |
| Dark code block | `src/components/docs/DocsCode.tsx` |
| "Was this page helpful?" (local only) | `src/components/docs/PageFeedback.tsx` |
| API Coverage content | `src/data/docs/pages.ts` (`"api-guide/coverage"`) |

## Measurements: reference vs this build (1440 px, production build)
| Item | Reference | LexBharat |
|---|---|---|
| Announcement bar | 40 px, `#5a2d27`, 14 px / 500, white 95 %, dismiss button 26 px at right | same |
| Header total (bar + row + tabs) | 152 px, sticky | 152 px, sticky |
| Search | 437 x 36 px, `#f4f1ec`, radius 12 px, `⌘K` chip | 437 x 36 px, same colours and radius |
| Tab row | 48 px high, 48 px side padding; tabs at x = 48 / 171 / 324 / 427, widths 99 / 128 / 79 / 131; active underline 1.5 px primary | identical positions and widths |
| Sidebar | starts x = 32, 288 px wide (256 px of content), items 256 x 36 px, 32 px between groups | identical |
| Group header | uppercase, 14 px / 600, `#1a1818`, 14 px icon, 10 px gap, 16 px left padding, 10 px below | identical |
| Item | 14 px / 24 px, `#414040`, padding 6 / 12 / 6 / 16, radius 12 px, 1 px between items, wraps on spaces | identical |
| Active item | `#6e3730` text on `#6e3730` at 10 %, radius 12 px, faint text shadow for weight | identical |
| Main column | article starts x = 363, 689 px wide; title 36 px / 600; right rail x = 1144, 264 px wide; page padding 32 px | identical |
| "On this page" | links 14 px / 500, 32 px rows, active in primary | same, with a left rule and one indent level |

The announcement bar copy is the reference text ("New: DOJ Justice Manual, USCIS Policy Manual, USPTO MPEP/TMEP, and DFARS PGI are now in the API.") with a local "See what's covered." link. Below 1024 px the sidebar becomes a drawer that starts at the header's real bottom edge, locks page scroll and closes on Escape or navigation; the right rail appears from 1280 px.

## Sidebar (Data API Guide tab)
Groups, in order, each with its icon: **Data coverage** (database) · **Use cases** (lightbulb) · **Get started** (rocket) · **Bulk, SQL & rights** (server) · **Core concepts** (book-open) · **Law change alerts** (bell) · **Working with the API** (code) · **Grounding AI** (sparkles) · **Recipes** (flask). 43 links in all; every link opens a real page whose title equals the sidebar label. The reference lists ten recipes; the first five are the ones in the brief and the other five (Map a compliance requirement to the governing law; Compare a rule across states; Monitor corpus coverage and changes; Enrich a citation database with source text; Add the corpus as an AI agent tool (MCP)) are kept after them so nothing the reference shows is dropped. The other tabs show their own groups: Data API Reference, Integrations, India API Reference.

## Deliberate differences
- Product name (LexBharat), the local wordmark, and the right-hand header links (Open US Law Dataset, Support and Dashboard go to local pages: `/open-us-law`, `/support`, `/developer`).
- The "Copy page" menu offers "Copy page" and "Copy page link"; "Was this page helpful?" stores nothing; "Last modified on" is the date these pages were last edited in this project.
- Icons are original stroke drawings of the same subjects, not the reference's icon font.
- Gray text on the cream background is `#65625f` rather than the reference's `#737171` (which measures 4.29:1 there; below 4.5:1).
- All page copy except labels and headings is rewritten; counts and cadences are copied display numbers.

## Verification (production build, port 3100)
Served sidebar matches the brief's group order and item order exactly; 43 of 43 links return 200 with matching titles; one active item; the TOC anchors on API Coverage all resolve. See `qa/QA-REPORT.md` Addendum 3 for the browser audit.
