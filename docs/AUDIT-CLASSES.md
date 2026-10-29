# Audit of six bug classes (Oct 29, 2026)

Rule followed: a reported bug is an example of a class (CLAUDE.md). For each class: the general cause, every place found, the shared fix, the automated check, the counts.
Re-run the data checks with `node scripts/audit/clean-check.mjs`, `node scripts/audit/title-check.mjs`, `node scripts/audit/ui-scan.mjs`; the unit checks run with `npm run test:extract` (`src/ui-audit.test.mjs`, `src/lib/text/clean.test.mjs`, `src/lib/docs/docType.test.mjs`, `src/lib/chat/shape.test.mjs`).

## 1. Source text shown raw

**Cause:** each page cleaned (or did not clean) the data's text its own way; there was no shared display layer.

**What the data contains** (`scripts/audit/junk-scan-acts.mjs`, `junk-scan-judgments.mjs`; raw counts in `docs/audit-junk-*.json`):

| Junk | Act sections (211,315) | Regulator sections (104,547) | Judgments (35,596) |
|---|---:|---:|---:|
| `==> picture ... omitted <==` placeholders | 3,867 | 5,872 | 1 |
| amendment numbers `4[words]` | 21,379 | 10,304 | 5,178 |
| footnote references `[1] [( 1 )]` | 20,435 | 2,123 | n/a |
| markdown (`**`, `_x_`, `##`, `>`) | 130,741 / 52,034 / 40,033 / 30,059 | 49,316 / 13,072 / 35,972 / 8,592 | 1,225 / 312 / 102 |
| HTML tags or entities | 6,080 | 11,187 | 71 |
| lost characters (U+FFFD) | 1,470 | 819 | 97 |
| spaced brackets `( a )` | 1,522 | 227 | 2,892 |
| literal backslash escapes | 922 | 197 | 2,096 |
| control characters | n/a | n/a | 254 |
Also seen: running heads in judgments ("SUPREME COURT REPORTS", 10,633 judgments; "The Judgment of the Court was delivered by", 20,637): kept, they are the printed report's furniture.

**Places that showed source text** (all found): the law page blocks; the Ask cited page paragraphs; Search snippets (Acts: 4 builders; regulators: 2); Ask source previews; the text the answer model reads (it saw `4[...]` numbers that look like citation numbers); the judgment reader and its opening-text preview; the Vault preview (per page); review quotes; the shared Highlight component; and headings, chapters and previews printed in 19 places in 6 components (law page contents, Constitution contents, search results, Ask source rows, cited page, drafting basis).

**Fix, once:** `src/lib/text/clean.mjs` (junk removal, markdown, spacing, joined words, amendment numbers as footnote marks in reading views and dropped in plain text) and `src/components/text/DisplayText.tsx`. Every site above uses it; the data layer returns display-clean section text (`sectionBodies`) and snippets.

**Checks:** `clean.test.mjs` (synthetic samples of every pattern); `RESIDUE` patterns (`src/lib/text/residue.mjs`); `clean-check.mjs` samples random real texts: 6,060 sampled, 10 (0.17%) still show a bracket or spacing oddity, all inside text that is itself garbled OCR; rule R9 in `src/ui-audit.test.mjs` fails if a data text field is printed without the layer (it found 19, now 0).

## 2. Every document treated as an Act

**Cause:** unit words came from the number alone ("Section N" by default), the source link was always India Code, titles were printed as stored.

**Found:** 9 places that built "Section N" or called `sectionWord` (search results, Ask source rows, cited page, drafting basis, review blocks, the answer prompt, the missing-section sentences, the law page heading and counts, source labels); 6 places that sent a reader to India Code whatever the document was (law page, its notices, search notices, missing-section notice); 22,265 titles of which 3,453 looked wrong (all lower case, ALL CAPITALS, `Advisory022026`, `%20`, underscores, hyphen-joined, `01July2017`).

**Fix, once:** `src/lib/docs/docType.mjs` (document type, unit word, source link and its name, title tidying) with `src/config/acronyms.json`. Titles leave the data layer display-ready (search, regulator search, Acts list, quick-find, cited page). A regulator instrument with no link shows no link, not a wrong one (4,107 of 12,152 have none).

**Checks:** `docType.test.mjs`; `title-check.mjs` runs all 22,265 titles (3,453 wrong before, 0 after); the UI audit fails on `sectionWord(` or a hard-coded "Section" before a number in any screen.

## 3. Looks clickable but is not / clickable but does not look it

**Cause:** pages styled their own controls.

**Found by a parser-based scan of every screen (`scripts/audit/ui-scan.mjs`, rules R1-R7):** 7 hits: the error page (button without a type, unstyled button and link: 3), the user menu's "Log out" (the whole row reacted to hover but only the words were a button), 2 result cards whose title link stretches over the card (false positives, the rule now knows the pattern) and the Quick-find option rows (a listbox pattern, now known). 5 real, 2 recognised patterns.

**Fixed:** the error page uses the shared Button; "Log out" fills its row. **Check:** `src/ui-audit.test.mjs`.

## 4. Layout overlap

**Cause:** sticky offsets were typed per page and the header's real height (bar plus testing banner) was not known to the rest of the page.

**Found:** 4 sticky columns that stuck under the header (law page contents and notes, judgment margin, Ask cited page used a different value, legal-page contents `top-24`); no page-wide scroll offset, so anchors, `scrollIntoView` (judgment reader 4, vault 1) and keyboard focus could land under the header (3 places patched it per element with `scroll-mt-24`); a fixed bottom padding on every page.

**Fix, once:** the header publishes its height (`StickyHeader`, `--header-h`); `html { scroll-padding-top/bottom }` and the Tailwind names `top-header` and `pb-page-bottom` in the tokens. **Check:** the layout test in `src/ui-audit.test.mjs` fails on any numeric sticky top, any per-element scroll margin or a fixed padding on `<main>`.

## 5. Leftovers from the old design

**Found:** "Browse Laws & Judgments" (court page breadcrumb), "chat" in 6 user-visible strings (Ask loading and not-found messages, the Desk's fallback title, the Vault intro, the admin table, the Privacy text x3), 7 unused exports of the old marketing component file, 4 stale comments naming `/workspace/...` addresses. Not touched: the old `PageHero` and `DataNote` still serve the Terms, Privacy and Security pages (Phase 7 replaces them) and the redirects keep the old addresses on purpose.

**Fixed; check:** the wording test in `src/ui-audit.test.mjs` fails on "Browse Laws", "Workspace", "Developer console", "Playground" and "a/your/this chat" in any screen text.

## 6. Answer quality

**Found (stored evaluation answers, 190):** 8 whose top sources contained the same section twice (a second Act record of the same law: IPC 302, 498A, 379, Arbitration s.7); 19 that open with a hedge; 0 that repeat a citation inside a sentence; 84 with a "Related provisions" list (not measurable without a per-question list).

**Fix, shared:** `dedupeCopies` removes a section filed twice from Ask's sources and from every Search result; `src/lib/chat/shape.mjs` (answer first, related provisions only if they apply, a citation once per sentence) behind the `currentLaw` and `citationCheck` switches, to be evaluated with (c) and (d). The scorer now counts duplicate citations, duplicate sources and hedges on every question and marks an answer with any of them not right (`scripts/eval/e2e.mjs`).

## Browser sweep (`npm run ui-sweep`), Oct 29, 2026

Run before every push. It starts its own server (`scripts/ui-sweep/serve.sh`, port 3300: no AI keys, no Supabase, nothing written, no model quota; Ask is answered from a canned stream with real sections) and opens 25 page types in Chrome at 1280 px and 375 px: Desk, Ask (empty; with an answer and the cited panel, on a phone the bottom sheet opened), Search (Laws, Judgments, Your documents), Library (overview, Acts, Constitution, Regulators, Judgments, a court), a law page, an Act, a regulator document, a judgment, Work (Drafts, Reviews, Vault), Terms, Privacy, Security, the password page, the error page, the 404 page. It also opens 3 addresses of every kind of link found (69 of 853) to see that none leads to an error.
Checks: **hidden** (under the header or the tab bar: at the top, at the bottom, after keyboard focus, sticky columns), **hscroll**, **raw** (the display layer's residue list plus programming leftovers, and per-page rules: a regulator document must not mention India Code or say "Section"; a case name must not end in "versus"), **wording** (old design, developer wording, "placeholder"), **clickable** (pointer cursor on a non-control, links to nowhere, nameless buttons, links to error pages), **console** (console errors, failed requests, broken images). A self-test page with one planted defect per check runs first: if the sweep stops seeing one it fails before looking at the app. Exceptions go in `scripts/ui-sweep/allow.json`, each with a reason. Screenshots: `.ui-sweep/<viewport>/<page>.png` (not committed).

### What the first runs found (all fixed in shared code; each class now has a check)

| Class | Places | Cause and fix | Check |
|---|---:|---|---|
| A sticky column taller than the screen is cut off at the bottom (Act contents list, notes, judgment margin, Ask cited page, legal-page contents) | 5 | each sticky column set its own height; `max-h-sticky` (Tailwind) = screen minus header, scrolls inside | `ui-audit.test.mjs` fails on `sticky` + `top-header` without `max-h-sticky` (it found the 5th, `LegalView`, after I had fixed 4); the sweep measures every sticky element |
| B a regulator document dressed as an Act: breadcrumb "Library > Acts", "Open the original on India Code", "N filled in from India Code", "compiled from India Code" | 4 on the law page | `sourceInfo` accepted India Code for any document; `libraryHome(doc)` gives the Library tab; provenance and counts say what is true for the type | `docType.test.mjs`; sweep rules on the regulator page |
| C a case name that ends in "versus" or "v. ." because a party is missing | every judgment list, search, case page (all courts) | `caseTitle` and punctuation-only parties dropped, once, in `getJudgmentsStore` and the Supreme Court index rows | `docType.test.mjs`; sweep rule on Search/judgment pages |
| D half an emphasis mark left in a snippet ("ibid_") and runs of dashes ("------for") | all text through the display layer | `stripMarkdown` in `src/lib/text/clean.mjs`; two new patterns in `residue.mjs` | `clean.test.mjs`; sweep raw check |
| E developer wording on a user page ("restart the dev server" on the error page) | 1 | reworded; "dev server" and "placeholder" added to the old-wording list (`scripts/ui-sweep/rules.mjs`, shared with the unit audit) | `ui-audit.test.mjs`; sweep wording check |

Not fixed, listed in `allow.json` or here: Terms, Privacy and Security still say "recreated placeholder" (Phase 7 replaces them); on a phone the tab rows (Search, Library) scroll sideways and the first or last tab can show cut off (by design, no hint that more is there); `2 texts still show junk` in `clean-check` (garbled OCR); the Vault page showed "not set up" because the sweep server has no storage.
