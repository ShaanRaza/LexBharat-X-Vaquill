# Drafting (W5)

Written 2026-10-23. `/workspace/drafting` in the Legal Workspace. Free plans only; the paid switches are in `docs/PAID-SWITCHOVER.md` (section 4c).

## What it does
1. **Pick a template**, or describe the need in a sentence ("my tenant's cheque bounced..."): one cheap model call (`templatePick`) names the closest template, says why, and says whether the fit is good, partial or poor.
2. **Fill the form** the template defines (parties, addresses, dates, amounts, the state, ...), plus optional extra instructions. Dates and amounts are checked; amounts are shown in figures **and** words by code (Indian grouping, "Rupees Two Lakh Fifty Thousand only"), never by the model. A period's end date (rent: start date plus months) is also worked out by code.
3. **Generate**: the law is retrieved first (the template's exact sections, for example "138 NI Act", plus a search), then the draft is written **one section at a time** and streamed, with a progress list. A section that fails is marked "Not generated, retry"; the rest is kept.
4. **Edit** in the browser (TipTap, free): bold, italic, underline, headings and lists only, so what you see is what exports. Missing information shows as highlighted placeholders such as `[TENANT'S ADDRESS]`. Autosave every 1.5 s; version history; "Save a version"; restore.
5. **Export** `.docx` (Word and Google Docs; placeholders highlighted; disclaimer in the footer) and PDF (embedded Noto Serif so the rupee sign and Devanagari print; page numbers, disclaimer), or **Copy** the text.
6. Drafts are saved per browser in the main Neon database and listed on the Drafting page and under Drafting in the sidebar.

## Rules the code enforces (not just asks of the model)
- **Retrieved law only.** The model is told to cite an Act only if it is in the numbered legal sources and to use its time limits exactly. After writing, every "Section N of <Act>" in the draft is checked against the retrieved sections; one that was not retrieved is shown as a warning ("check it or remove it"). Amounts in the draft that were not in the user's details or the retrieved text are flagged the same way. The "Legal basis" panel shows the retrieved sections with citation chips linking to the section pages, separated into *named in this draft*, *relied on by the template*, and *also retrieved, not used*.
- **No invention.** A required fact that is missing becomes a placeholder; an optional one that was not given is left out (some optional ones, such as the notice date or the notice period, are set to "placeholder" in the template). Placeholders are forced to capitals so they are always found and highlighted.
- **Stamp duty:** the prompt forbids stating a stamp duty, fee, rate or penalty unless a retrieved section does, and the reminders written into the templates state no amounts (unit-tested). The checklist ("Check before you use it") lists stamp duty, registration and notarisation as things to check, each flagged "Check"; state-specific items show only for their state.
- **Labels:** "Draft for review by a qualified lawyer. Not legal advice." at the top of every draft, in the footer of every export, plus the testing banner "don't enter confidential client information".

## Templates (`content/templates/*.json`, one file per template, id = file name)
Fields (key, label, type text/textarea/date/amount/number/select/state, required, hint, options, `when`, optional `placeholder` and `ifMissing`), sections (id, title, `instruction` for the model, or `fixed` text with `{{field}}` / `{{a|b}}` tokens that needs no model call), the law it relies on (`relies_on`, `state_relies_on` by state, `conditional_relies_on`, as lookups like "138 NI Act"), `search_queries`, and `reminders`. `scripts/drafting/build-templates.mjs` checks every file before dev, build and start (bad lookups, unknown tokens, duplicate ids...) and stops with a list of problems. **To replace a template with a real one: replace the file and redeploy; no code change.** The five shipped templates were written for this project in plain legal English and are general, not a substitute for a firm's own forms.

## Limits and failure handling
5 drafts a day and 20 a week per browser, 600 a month in total, 20 saved drafts per browser (`src/config/drafting-limits.json`, env `DRAFT_LIMIT_*`). A draft that fails completely is not counted. If the model is busy a section falls back to the next model in the chain; if that fails too the section is marked for retry (the editor has a Retry button that rewrites just that section in the same context). Free Gemini output limits are respected by writing section by section (each call is short).

## Email when ready (off unless configured)
"Email me when it's ready" appears only when `RESEND_API_KEY` and `RESEND_FROM` are set. The address is used once in memory to send the link and is never stored or logged. Setup steps: `docs/PAID-SWITCHOVER.md` section 4c.

## Models
`drafting` and `templatePick` in `src/config/ai-models.json` (free Gemini now; Claude Sonnet 5.5 and Haiku 5.5 later by config, see PAID-SWITCHOVER.md).

## PDF fonts and licence
The PDF embeds **Noto Serif** (Latin, Latin Extended) and **Noto Serif Devanagari** as WOFF files in `src/lib/drafting/fonts/`, subsetted per document with `@pdf-lib/fontkit`. A character is taken from the first font that has it (Latin, then Latin Extended, then Devanagari), so the rupee sign prints as "₹" and Hindi text shapes correctly. The `.docx` also uses "₹". Licence: SIL Open Font License 1.1 (free to embed and redistribute); licence texts are in the same folder (`OFL-NotoSerif.txt`, `OFL-NotoSerifDevanagari.txt`, plus `README.md`). The export route lists the font folder in `outputFileTracingIncludes` (`next.config.mjs`) so it is deployed with the function. Checked: the PDF opens and `pdftotext` extracts "₹" and Devanagari text correctly.

## Tests (2026-10-23, local port 3100, stub model for the failure and limit cases, real Gemini and Voyage for the retrieval cases)

### All seven drafts
| # | Draft | Time | Sections written | Placeholders left for missing information | Law relied on (all retrieved from our Acts) |
|---|---|---|---|---|---|
| 1 | Cheque-bounce demand notice (s138) | 48 s | 7/7 | [PAYEE'S PAYMENT DETAILS] | Negotiable Instruments Act, 1881 s138; Negotiable Instruments Act, 1881 s142 |
| 2 | General legal notice (refund of a flat advance) | 15 s | 7/7 | [MODE OF SERVICE] | none fixed: found by search (Real Estate (Regulation and Development) Act, 2016 s18 was the one used) |
| 3 | Non-disclosure agreement (mutual) | 24 s | 9/9 | none needed | Indian Contract Act, 1872 s10; Indian Contract Act, 1872 s27; Indian Contract Act, 1872 s74 |
| 4 | Rent: leave and licence, **Maharashtra** | 118 s | 7/8 (1 failed, the rest kept) | [DATE OF SIGNING], [RENT DUE DATE], [SECTION NOT GENERATED: PREMISES AND USE. USE RETRY.] | Transfer of Property Act, 1882 s105; Transfer of Property Act, 1882 s107; Registration Act, 1908 s17; Maharashtra Rent Control Act, 1999 s55; Maharashtra Stamp Act s36A |
| 5 | Rent: tenancy, **Karnataka** (occupier's address left out on purpose) | 39 s | 8/8 | [DATE OF SIGNING], [MAINTENANCE CHARGES], [NOTICE PERIOD IN DAYS], [OCCUPIER'S PERMANENT ADDRESS], [RENT DUE DATE] | Transfer of Property Act, 1882 s105; Transfer of Property Act, 1882 s107; Registration Act, 1908 s17; KARNATAKA RENT ACT, 1999 s4; KARNATAKA RENT ACT, 1999 s16 |
| 6 | Service agreement (arbitration) | 29 s | 10/10 | [CONFIDENTIALITY PERIOD], [CURE PERIOD], [LIABILITY LIMIT, IF ANY], [NOTICE PERIOD IN DAYS], [NUMBER OF ARBITRATORS] | Indian Contract Act, 1872 s10; Indian Contract Act, 1872 s74; Arbitration and Conciliation Act, 1996 s7 |
| 7 | Cheque-bounce notice (advocate, date and place left out on purpose) | 35 s | 7/7 | [DATE OF THIS NOTICE], [PAYEE'S PAYMENT DETAILS], [PLACE] | Negotiable Instruments Act, 1881 s138; Negotiable Instruments Act, 1881 s142 |

### Editor API checks: 18/18 passed
Create, read, autosave (PUT), invalid document rejected, version list (generated, checkpoint, saved), checkpoint cap of 4, restore (makes a before-restore version), rename, delete, other browser's draft not readable (404), section retry fills only the failed section, retry on a notice renumbers, .docx and PDF export return the right type, daily-limit response (429 with message).

### Browser checks
| Check | Result |
|---|---|
| Live generation view: progress list ticks section by section; Legal basis panel splits used vs retrieved | Pass |
| Editor: placeholders highlighted, edit and autosave | Pass |
| Version history lists autosave checkpoints without reload; restore works | Pass (list refresh bug found and fixed) |
| Rename, delete, Copy | Pass |
| .docx and PDF download; PDF shows "₹" | Pass |
| One section forced to fail: draft keeps the rest, Retry fills only that section, neighbours untouched | Pass (editor re-applied old content after retry: fixed) |
| Retry on a notice: following numbers continue 1,4,7,10,13,16 | Pass (fixed) |
| Daily-limit message on screen | Pass |
| 375px width: Drafting home, form, generation view, editor | Pass |
| Keyboard: tab through home, form, editor; visible focus ring | Pass (editor ring added) |
| Email field hidden while Resend is not configured | Pass. The visible-when-configured case is covered by unit tests only |
