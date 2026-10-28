# LexBharat App Structure & Design Spec

Oct 28, 2026 · @Akshita

## Summary

LexBharat becomes **one India-only legal product** built around its tagline, *"Legal work in India, traced to the page."* Every answer, search result and draft leads back to the exact paragraph of law or judgment, shown like a marked page in a book.

The app keeps every working feature (search, Ask, Drafting, Review, Vault, the judgment reader) and changes only how they are arranged and how they look. Nothing in the backend changes.

The Vaquill-shaped parts go: the product switcher, the country flag, the left sidebar with dashboard cards, and the mock Developer console. In their place come five areas — **Desk, Ask, Search, Library, Work** — reached from a slim top bar on desktop and a bottom tab bar on phones.

- **Marketing site:** lexbharat.ai (already live, unchanged).
- **App:** app.lexbharat.ai (this spec).
- **Visual language:** taken from lexbharat.ai and the design repo mrharit/Lex-bharat, with logo direction 1a (pilcrow with trace line).

## Brand and visual language

The app should feel like an extension of lexbharat.ai: calm paper, forest green, serif headings, and the cited paragraph always lifted out of the page.

| Element | Choice |
| --- | --- |
| Logo | Direction 1a, pilcrow (¶) with trace line. Mark, circular crop, horizontal lockup, reversed on forest #1F4D3A and deep forest #173D2E, favicons 32 / 16 px |
| Wordmark | "Lex" regular + "Bharat" bold, serif |
| Page and cards | Paper #F4F5EF, white cards, ink #0F1F1A |
| Brand colour | Forest #1F4D3A (buttons, active states); deep forest #173D2E for dark bands |
| Status colours | Green = verified, ochre = needs a look, red #8A2E2A = problem (used sparingly) |
| Headings | Source Serif 4 |
| Text and UI | Geist; Geist Mono for small uppercase labels |
| Hindi | IBM Plex Sans Devanagari, loaded only when Hindi appears |
| Shapes | Pill buttons and chips, 12 px inputs, 16 px cards |
| Type sizes | Reading text (laws, judgments) 17 px; app screens 14–15 px |
| Signature device | The **marked page**: the cited paragraph sits on white with a forest outline and corner brackets; the rest of the page dims slightly |

**Tone of voice:** plain, precise, honest. Short sentences. Never overclaim: coverage limits, "possibly incomplete" and "not legal advice" notes stay visible.

I couldn't open lexbharat.ai directly (it blocks automated tools), so these values come from the design repo and the logo PDF. Claude Code will check them against the live site before building.

## Site map

Everything hangs off one top bar. Whichever area a lawyer starts in, the trail ends on a law page or a judgment page with the cited paragraph marked.

## Navigation

No left sidebar. Five areas, always one tap away.

**Desktop: slim top bar**

- Left: ¶ LexBharat logo (goes to Desk).
- Centre: Desk · Ask · Search · Library · Work. The current area is underlined in forest.
- Right: **Quick-find** box (also opens with ⌘K / Ctrl+K), then a small menu with Log out and Feedback.
- Under the bar: the testing banner, one line, until launch.

**Quick-find (⌘K)**

- One box for everything: type "138 NI Act", "Order 7 Rule 11", "Article 21", a case name, or a past chat or draft title.
- Results grouped: Laws · Judgments · Your work. Enter opens the top one.

**Phone: bottom tab bar**

- Same five areas as icons with labels: Desk, Ask, Search, Library, Work.
- Top: logo and a search icon that opens Quick-find full screen.
- Reading pages (laws, judgments) hide the tab bar while scrolling down and show it when scrolling up.

**Inside an area:** a simple row of tabs under the page title (for example Library → Acts · Constitution · Regulators · Judgments), never a second sidebar.

## Page by page

Every current feature has a home; none is lost.

### Desk — the home page (`/`)

- A large serif greeting line and **one big box**: "Ask a question, find a law, or paste a section."
- The box understands what was typed: a question opens **Ask**; a citation ("138 NI Act", "O.7 R.11", "Article 21") opens the **law page**; a case name opens the **judgment**; anything else opens **Search**.
- Small suggestion chips under the box (e.g. "Notice period for cheque bounce", "Article 21", "Draft a legal notice").
- **Recent work**: a quiet list of your last chats, drafts and reviews, newest first.
- **Coverage line**: one honest sentence on what's included (Acts, Constitution, Supreme Court judgments, regulators) and what isn't yet.

### Ask (`/ask`, `/ask/<id>`)

- A **reading desk**, not chat bubbles.
- **Left:** your question as a heading, the answer below with numbered citation chips, the confidence label (Supported / Partly supported / Check sources / Not found), and "Was this right?" in the margin.
- **Right:** the cited page, opened at the exact paragraph with the marked-page highlight. Clicking a chip switches the page on the right.
- Below the answer: follow-up box, "Attach from Vault", and the list of sources (cited first, others folded under "Also searched").
- Phone: answer first; tapping a chip slides the cited page up from the bottom.
- Past questions: listed on Desk and in Work, not in a sidebar.

### Search (`/search?q=`)

- Tabs: **Laws · Judgments · Regulators · Your documents**, each with a count. Your documents searches inside Vault files (by meaning and exact words) and shows the passage, file name and page.
- Toggle: **By meaning / Exact words**.
- Filters on the left on desktop (Central/State, state, year, court, in force/repealed), in a sheet on phone.
- Each result: title, a short snippet with matched words highlighted, labels (possibly incomplete, repealed, filled from India Code), and a link straight to the paragraph.

### Library (`/library`)

- Tabs: **Acts · Constitution · Regulators · Judgments**.
- Acts: Central and State lists with filters (category, state, status) and a search within the list.
- Constitution: Parts and Articles as a contents list, Schedules at the end.
- Judgments: Supreme Court and each High Court, then year, then the case list (12 per page, "Jump to year", all-years toggle).

### Law page (`/law/<act>/<section>`)

- A **book layout** in three columns on desktop:
  - **Left:** contents (Parts, Chapters, sections; Orders/Rules and Schedules where they exist).
  - **Centre:** the section text at 17 px reading size, the selected section marked.
  - **Right margin notes:** judgments that cite this section, the source and date (dataset or "Filled in from India Code"), quality warnings, repealed notes with a link to the new law.
- Schedules such as the Limitation table show as a proper table.
- Phone: contents behind a button; margin notes move below the text.

### Judgment page (`/judgments/<court>/<case>`)

- Case header: parties, court, date, citation, bench, outcome, with honest "not in dataset" notes.
- The reader: first 20 paragraphs, "Show full judgment", search within the judgment, paragraph numbers, back to top.
- **Margin:** "Laws referred to" (each a link to the law page) and the provenance panel.
- High Court cases without full text say so clearly.

### Work (`/work`)

- One place for everything you've made. Tabs: **Drafts · Reviews · Documents (Vault)**.
- Each tab: a list with search and sort, plus its main action ("New draft", "Review a contract", "Add documents").
- Each Ready card in Documents has three actions: **Ask about this** (opens a new chat with it attached), **Review** (starts a contract review) and **Preview** (shows the read text, marked "Read from scan — check the original" when OCR was used). After an upload finishes, a hint says: "Ready. Ask a question about it or run a review." Already built on reskin (9806603); keep it in the new Work page.
- Drafting keeps its flow (pick a template or describe it, fill the form, watch it write, edit, export .docx / PDF).
- Review keeps its flow (pick a document, contract type and side, results with risks, suggested changes, missing clauses, Indian law points, export).
- Vault keeps upload, processing status, preview, rename, download, delete, and "Use in Ask".

### Other screens

- **Password page:** forest background, white card with the ¶ logo, one field.
- **Admin insights** (`/admin`): kept, separate password, plain layout.
- **Privacy, Terms, Security:** short truthful pages describing what LexBharat actually stores and uses, linked from the footer and from lexbharat.ai.

## Removed from the current app

These came from the earlier Vaquill-shaped build and go away entirely (kept only in git history):

- **Product switcher** ("PRODUCT" pill, "Legal Data & API" / "Legal Workspace").
- **Country flag** selector — LexBharat is India only.
- **Left sidebar** with the dashboard-cards home page.
- **Mock Developer console:** Overview, Playground, Law Change Alerts, API Keys, Credits & Usage, Billing, MCP Server, the US sample data and the demo banner. A real API can come back later with its own design.
- **Docs pages** copied from the earlier recreation.
- **Vaquill-derived wording** anywhere ("Workspace", "Legal Data & API", "Data API" link, product tours).

## URL map

Every old address redirects to its new home, so bookmarks and shared links keep working.

| Old address | New address |
| --- | --- |
| `/workspace` (Dashboard) | `/` (Desk) |
| `/workspace/chat`, `/workspace/chat/<id>` | `/ask`, `/ask/<id>` |
| `/workspace/browse` | `/library` |
| `/workspace/browse/acts/<act>?section=<s>` | `/law/<act>/<s>` |
| `/workspace/browse/judgments/<court>` | `/library/judgments/<court>` |
| `/workspace/browse/judgments/<court>/<year>/<case>` | `/judgments/<court>/<case>` |
| `/workspace/drafting`, `/workspace/drafting/<id>` | `/work/drafts`, `/work/drafts/<id>` |
| `/workspace/review`, `/workspace/review/<id>` | `/work/reviews`, `/work/reviews/<id>` |
| `/workspace/vault` | `/work/documents` |
| `/admin/insights` | `/admin` |
| `/developer`, `/developer?tab=*` | `/` (Desk) |
| `/docs/*` | `/` (Desk) |

Claude Code checks the exact current routes and fills any gaps in this table before building.

## Shared components and rules

**Components used everywhere** (one design each, reused on every page):

- Top bar, phone tab bar, Quick-find (⌘K)
- The big Desk box
- Marked page (cited paragraph lifted out of the page)
- Margin notes column
- Citation chips (law, judgment, your document — three looks)
- Labels: Supported / Partly supported / Check sources / Not found; possibly incomplete; repealed; filled from India Code; read from scan
- Buttons, inputs, tabs, filters, cards, notices, empty states, "Was this right?" feedback

**Rules that don't change with the new look:**

- **Honesty first:** coverage limits, quality warnings, "not legal advice" and the testing banner stay visible.
- **Password gate** stays on the app; Privacy, Terms and Security are public.
- **Accessibility:** text contrast at WCAG AA, every feature usable by keyboard, works at 375 px phone width.
- **Design tokens:** all colours, fonts, sizes, spacing and radii in one tokens file; no hard-coded styles in pages.
- **Backend untouched:** search, Ask, Drafting, Review, Vault, limits and feedback keep the same logic and data; only screens and routes change.

## Rollout and open questions

Built on the `reskin` branch, shown on app.lexbharat.ai while in progress, merged into `main` only when approved. Each phase stops for screenshot approval.

1. **Remove** the switcher, flag, mock console and copied docs.
2. **New shell:** top bar, Quick-find, phone tabs, ¶ logo and favicons.
3. **Desk** plus the new addresses and redirects.
4. **Ask** as a reading desk.
5. **Library**, law page and judgment page.
6. **Work** (Drafts, Reviews, Documents).
7. **Public pages:** Privacy, Terms, Security, written truthfully.
8. **Final checks**, merge into `main`, point app.lexbharat.ai back to Production.

**Open questions**

- Should Desk show a short "what's new" or tips area, or stay minimal?
- Does lexbharat.ai's "Get started" go straight to the password page, or to a waitlist first?
- Do you want a light/dark switch, or light only for now?
- Keep "Was this right?" text, or thumbs icons in the margin?
