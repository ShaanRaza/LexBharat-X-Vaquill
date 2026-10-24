# Vault, Review and documents in Chat (W6)

Written 2026-10-24. `/workspace/vault`, `/workspace/review` and "Attach from Vault" in Chat. Free plans only; the paid switches are in `docs/PAID-SWITCHOVER.md` (section 4d).

## What it does
1. **Vault.** Upload PDF, Word (.docx) or text files (10 MB each; 30 documents and 100 MB per browser). The browser sends the file straight to a private Supabase bucket through a short-lived signed URL; the server then reads its text with free libraries (`unpdf` for PDF, `mammoth` for Word), cuts it into passages (about 1,100 characters, keeping the page and the clause heading), and embeds them with voyage-4 at 256 dimensions. The list shows name, type, size, pages, date and status (Processing… n/total, Ready, Can't read), with search by name, sort, rename, text preview, download through a 60-second signed link, and a real delete (file, text, passages and vectors).
2. **Scanned or damaged files.** A PDF with almost no text is reported as "This looks like a scanned document. Text reading for scans isn't available yet." A file whose bytes are not the type its name claims, a password-protected or damaged file, and files too long for the free plan each get their own message. Nothing fails silently.
3. **Review.** Pick a Vault document, the contract type (NDA, service agreement, rent / leave and licence, employment, other) and your side. The review is saved per browser and has: a summary (what it is, parties, term, money, governing law, overall Low / Medium / High risk); every clause with its reference, a verbatim quote, Acceptable / Negotiate / Escalate and a plain reason; suggested replacement wording with why; clauses usually found in this kind of contract but missing; and Indian-law points with citation chips. Export as .docx or PDF (the Drafting export and its Noto fonts). A banner says "Review for a qualified lawyer to confirm. Not legal advice."
4. **Documents in Chat.** See `docs/CHAT.md` (W6 section).

## How the checks are kept honest (in code, not just in the prompt)
- **Quotes** must really appear in the contract text (`quoteInText`); a quote that does not is dropped, not shown.
- **Law points rest only on retrieved sections.** The sections are fetched first (exact lookups such as "27 Indian Contract Act" chosen from the contract's own words and its type and state, plus a search), numbered, and the model may cite only those numbers. A point with no valid citation, or that names a section of an Act that was not retrieved, is dropped and counted ("n possible points were left out").
- **Rules that do not need a model** pick the law to fetch (`lawPlan`) and list clauses a contract of this type usually has but this one lacks (`missingClauses`, by the words being absent), so the obvious problems are never silently skipped. The overall risk is never lower than the clause results imply.
- **Parts.** A long contract is cut at clause boundaries into parts of 8,000 characters; each part is its own model call. A part that fails stays "Not reviewed, retry" and the rest is kept; Retry re-runs only that part (then the summary and law points, which depend on the clauses). A step that fails only because the free model was busy is retried twice automatically.

## Isolation and privacy
Every Vault and Review read or write names the anonymous browser id (the middleware sets it from a signed-in cookie and overwrites any value the client sends); a document or review that belongs to another browser answers "not found" for read, download, rename, process, delete, review, step and export. All five tables have Row Level Security on with no policies and no rights for the public roles; only the server's secret key (never sent to the browser, never `NEXT_PUBLIC_`) reads or writes. Files are never public. The pages say "Saved on this browser only. Testing phase: don't upload confidential client documents."

## Storage behind an interface
`src/lib/vault/storage.ts` defines `FileStore` (signed upload, get, remove, size, signed download, usage). The Supabase bucket is one implementation; Cloudflare R2 replaces it by adding a class and setting `VAULT_STORAGE=r2` (docs/PAID-SWITCHOVER.md, 4d). Nothing else knows which store is used.

## Where things are
| Part | Files |
|---|---|
| Rules (pure, tested) | `src/lib/vault/{files,chunk,extract,lexical}.mjs`, `src/lib/review/{rules,prompts,blocks}.mjs` |
| Server logic | `src/lib/vault/{supabase,storage,store,process,embedDocs,search}.ts`, `src/lib/review/{store,run}.ts` |
| API | `src/app/api/vault/**`, `src/app/api/review/**`, `src/app/api/chat/route.ts` (docIds) |
| Pages and UI | `src/app/(console)/workspace/{vault,review}/[[...slug]]/page.tsx`, `src/components/workspace/{vault,review}/`, `chat/AttachPicker.tsx`, `CitedText.tsx` |
| Config | `src/config/vault-limits.json`, `src/config/review-limits.json`, task `review` in `src/config/ai-models.json` |
| Setup and tests | `scripts/vault/{vault-schema.sql,setup-bucket.mjs,check-schema.mjs,make-test-contracts.mjs,api-test.mjs,resume-test.mjs,review-test.mjs,review-limits-test.mjs,chat-doc-test.mjs,sizes.mjs}` |

## Tests (2026-10-24; local port 3100, production build for the final API run; real Voyage and Supabase; real Gemini, see "Models")

### Vault, API level (`scripts/vault/api-test.mjs`, `resume-test.mjs`): 23 of 23 passed
| Check | Result |
|---|---|
| PDF, DOCX and TXT upload, then read and embed until Ready (PDF 2 pages, DOCX and TXT no page numbers; 3, 3 and 1 passages, all vectors stored) | Pass |
| Scanned-image PDF: "This looks like a scanned document. Text reading for scans isn't available yet." (status Can't read) | Pass |
| An .exe-style file renamed to .pdf is refused: "This doesn't look like a real PDF file, so it can't be read." | Pass |
| 10.5 MB file refused before upload ("The most is 10 MB per file."); unsupported type refused | Pass |
| List shows Ready and Can't read states; rename | Pass |
| Download through a signed link returns the file; the same link fails 65 seconds later (400) | Pass |
| 31st document refused (30 limit); total over 100 MB refused (declared sizes: 10 accepted, the 11th refused) | Pass |
| Delete really deletes: before 3 passages, 3 vectors, 1 file; after 0 records, 0 passages, 0 text, 0 files in the bucket | Pass |
| Processing resumes: a 20-passage file, tab "closed" after the first batch of 16 (stored: processing, 16 of 20); continued from that state to Ready with 20 vectors | Pass |
| Another browser: empty list; cannot read, download, rename, process or delete (each tried with and without a spoofed `x-lb-bid` header: 404 and 404); the document is untouched; a malformed id is 404 | Pass (8 checks) |

The 30-document and 100 MB limits are also unit-tested (`src/lib/vault/vault.test.mjs`). The 100 MB case used declared sizes (the server re-checks the real size when it reads the file and the bucket itself refuses anything over 10 MB), so no 100 MB was actually uploaded.

### Review, API level (`scripts/vault/review-limits-test.mjs`): 11 of 11 passed
Five reviews accepted in a day; the sixth refused with "You have reached today's limit of 5 reviews. It resets tomorrow."; usage shows 5 of 5; deleting a review does not give the allowance back; another browser cannot read, step, export or delete a review, sees an empty list, and cannot review someone else's document (404); a side that does not belong to the type is refused.

### The three fictional contracts, each as PDF and DOCX (`scripts/vault/review-test.mjs`): 22 hits, 2 misses
| File | What it should find | Result | Detail |
|---|---|---|---|
| nda-test-contract.pdf | flags the 5-year all-India non-compete (clause 4) | HIT |  |
| nda-test-contract.pdf | cites Indian Contract Act s.27 (restraint of trade) | HIT |  |
| nda-test-contract.pdf | flags the Rs 50 lakh penalty (clause 5) | HIT |  |
| nda-test-contract.pdf | cites Indian Contract Act s.74 (penalty) | HIT |  |
| nda-test-contract.docx | flags the 5-year all-India non-compete (clause 4) | HIT |  |
| nda-test-contract.docx | cites Indian Contract Act s.27 (restraint of trade) | HIT |  |
| nda-test-contract.docx | flags the Rs 50 lakh penalty (clause 5) | HIT |  |
| nda-test-contract.docx | cites Indian Contract Act s.74 (penalty) | HIT |  |
| service-agreement-test-contract.pdf | flags unlimited liability (clause 5) | HIT |  |
| service-agreement-test-contract.pdf | flags the English governing law / London courts (clause 7) | HIT |  |
| service-agreement-test-contract.pdf | a law point on the foreign law/courts or on damages is cited | MISS | Contract Act s.28 and s.73 are not in our Acts data (docs/MISSING-SECTIONS.md), so the model's point on them was dropped as unsupported rather than cited. |
| service-agreement-test-contract.pdf | lists a missing liability cap | HIT |  |
| service-agreement-test-contract.docx | flags unlimited liability (clause 5) | HIT |  |
| service-agreement-test-contract.docx | flags the English governing law / London courts (clause 7) | HIT |  |
| service-agreement-test-contract.docx | a law point on the foreign law/courts or on damages is cited | MISS | Contract Act s.28 and s.73 are not in our Acts data (docs/MISSING-SECTIONS.md), so the model's point on them was dropped as unsupported rather than cited. |
| service-agreement-test-contract.docx | lists a missing liability cap | HIT |  |
| maharashtra-leave-licence-test-contract.pdf | lists the missing registration clause | HIT |  |
| maharashtra-leave-licence-test-contract.pdf | lists the missing stamp duty clause | HIT |  |
| maharashtra-leave-licence-test-contract.pdf | cites Registration Act s.17 | HIT |  |
| maharashtra-leave-licence-test-contract.pdf | cites Maharashtra Stamp Act or Rent Control Act | HIT |  |
| maharashtra-leave-licence-test-contract.docx | lists the missing registration clause | HIT |  |
| maharashtra-leave-licence-test-contract.docx | lists the missing stamp duty clause | HIT |  |
| maharashtra-leave-licence-test-contract.docx | cites Registration Act s.17 | HIT |  |
| maharashtra-leave-licence-test-contract.docx | cites Maharashtra Stamp Act or Rent Control Act | HIT |  |

Hits and misses are judged by code against the saved review (a clause with that number flagged Negotiate or Escalate; a law point whose citation is that Act and section; the missing-clause list). Contract text: `scripts/vault/make-test-contracts.mjs` (fictional names, no real data). Both misses have the same cause, which is a gap in our data, not in the review: the Indian Contract Act sections the review would need for a foreign-courts clause (s.28) and for damages (s.73) are among the sections absent from the Acts data (`docs/MISSING-SECTIONS.md`). The model did try to write those points; the check dropped them because the sections were not retrieved ("1 possible point was left out"), which is the intended behaviour. The foreign law and unlimited liability clauses themselves were flagged Escalate in both formats. Earlier runs the same day, while the Gemini 3.6 flash quota lasted (before the fallback took over), gave the same hits plus fuller clause lists (13 clauses for the NDA instead of 7).

The exports were checked on each review: the .docx opens (macOS text importer) and the PDF extracts (`pdftotext`); both carry the disclaimer, the Suggested changes and the Indian law points. The PDF was checked visually (Noto Serif, tables of clauses, footer with page numbers). All of this was repeated on a production build (`npm run build` then `npm start`) to confirm the font files are traced into the export function.

### Partial failure and retry (stub model that refuses part 2; page cut to 1,500 characters a part)
A 5-part NDA: part 2 failed ("Not reviewed: The model is busy.", automatically retried twice after a pause, then left with a Retry button); parts 1, 3, 4, 5, the summary and the law points were kept (clauses 1.1, 3.1, 4.1, 5.1 shown). With the stub fixed and Retry pressed, clause 2.1 appeared and the other four were untouched (no Retry buttons left, "Review finished").

### Documents in Chat (real Gemini; the NDA PDF attached)
| Question | Label | What the answer did |
|---|---|---|
| What is the notice period in this agreement? | Supported | "Thirty (30) days' written notice", cited to the document (page 2, clause 7.1) with a document chip; says nothing in the Acts changes it |
| Is the non-compete enforceable? | Check sources | States what clause 4.1 says (five years, all India) from the document chip, and what Section 27 of the Indian Contract Act says (void to that extent) from an Act chip; it did not spell out the conclusion itself, so the checker labelled it Check sources. The first run the same day (3.6 flash) did conclude "void to that extent" and was Supported |

In the browser the same flow was run through the real page (Attach from Vault, ticked with the keyboard, question sent): the document chip is dashed and blue, the Act chip is solid, the sources list has a separate "Your documents cited" heading, and the attachment was cleared after sending (not sticky).

### Chat without attachments: the 12 questions again (nothing attached)
Result: 9 Supported, 1 Check sources, 2 Not found (W5: 9, 1, 2). Gemini 3.6 flash was over its daily quota, so the fallback model (3.5 flash-lite) answered and checked; the one Check this time is question 8, where W5 had question 4.

| # | Question | Label | Sources cited (first three) |
|---|---|---|---|
| 1 | What is the punishment for cheque bounce? | Supported | Negotiable Instruments Act s138; Negotiable Instruments Act s144; Negotiable Instruments Act s140 |
| 2 | Notice period before filing a cheque bounce complaint | Supported | Negotiable Instruments Act s138; Negotiable Instruments Act s142; Negotiable Instruments Act s106 |
| 3 | Can a minor enter a contract? | Supported | Indian Contract Act s11; Indian Contract Act s68; Presidency Small Cause Courts Act s32 |
| 4 | Maharashtra rent control: grounds for eviction | Supported | Maharashtra Rent Control Act s16; Maharashtra Rent Control Act s42; Maharashtra Rent Control Act s19 |
| 5 | How can I get anticipatory bail? | Supported | CODE OF CRIMINAL PROCEDURE s438; CODE OF CRIMINAL PROCEDURE s439; CODE OF CRIMINAL PROCEDURE s38 |
| 6 | What is the time limit to reply to an RTI application? | Supported | Right to Information Act s7; Right to Information Act s11; Right to Information Act s19 |
| 7 | What are the grounds for divorce under the Hindu Marriage Act? | Supported | Hindu Marriage Act s13; Special Marriage Act s27; Hindu Marriage Act s23 |
| 8 | What does section 138 of the NI Act say? | Check sources | Negotiable Instruments Act s138; Payment and Settlement Systems Act s25; Negotiable Instruments Act s137 |
| 9 | Can a tenant in Karnataka sublet the premises? | Supported | KARNATAKA RENT ACT s32; KARNATAKA RENT ACT s27; KARNATAKA RENT ACT s54 |
| 10 | Is an unstamped document admissible in evidence in Maharashtra? | Supported | Maharashtra Stamp Act s34; Maharashtra Stamp Act s35; Maharashtra Stamp Act s33 |
| 11 | What did the Supreme Court hold in the Arnesh Kumar judgment about arrests? | Not found in the Acts | none |
| 12 | Who won the cricket world cup in 2011? | Not found in the Acts | none |

### Browser checks (375 px wide, keyboard)
| Check | Result |
|---|---|
| Vault at 375 px: no horizontal scroll (page width 375); status badges, actions and the form fit | Pass |
| Vault by keyboard: Tab order is menu, Add documents, search, sort, then each document's name, Rename, Download, Delete; every stop shows a 2 px outline; rename opened by Enter, saved by Enter | Pass (focus goes back to that row's Rename button after saving, added after this test) |
| Vault: upload through the real file input (text and an image-only PDF): Ready and Can't read with the scan message; reload while a document is processing resumes it by itself | Pass (a bug found here: the resume loop used a stale list and did nothing; fixed) |
| Vault text preview page | Pass |
| Review at 375 px: no horizontal scroll; Tab order document, Add a document, type, side, Start, past reviews, Delete; all outlined | Pass |
| Review live progress (each part, summary, law points tick over), results, law points with chips linking to the Act sections, .docx/PDF links | Pass (the failed-part row wrapped badly at 375 px; fixed) |
| Chat attach list: opens, boxes ticked with Space, unreadable document disabled, Escape closes it, chosen documents shown as removable chips | Pass |
| Sidebar and Dashboard: Review and Vault are live links (no "Coming soon"); Dashboard "Live now / Not yet" updated | Pass |

### Sizes after the tests (`scripts/vault/sizes.mjs`)
At the end of the tests, before cleaning up: Supabase database 11.6 MB of 500 MB (28 documents, 53 passages, vectors included), file storage 0.3 MB of 1 GB (28 files). After the test data was deleted (all of it is fictional): database 11.6 MB (that is Supabase's own base size; the vault tables hold a few hundred KB), storage 0 MB. Neon main database 692.6 MB (693 MB before this work): unchanged, nothing here writes to Neon.

A rough rule for planning: a contract of 10 pages is about 25 KB of text, 20 passages and 20 vectors of 256 numbers (about 1 KB each), so well under 100 KB of database; the 500 MB database limit allows several thousand such documents, and the 1 GB storage limit is reached first by large PDFs.

## Scanned documents (W8)
Scanned PDFs, JPG and PNG files are now read instead of refused: image-only pages go to the `ocr` model task (a few pages per step, saved page by page, resumable), text pages of a mixed PDF are left as they are. Limits: 20 scanned pages per document, 5 scanned documents per browser per day; a busy model leaves the document in "Waiting to read". Page numbers are kept for citing, and every place the text is shown or cited says "Read from scan — check the original". Details, limits and test results: `docs/W8.md`. New tables and columns: `scripts/w8/w8-schema.sql`.
