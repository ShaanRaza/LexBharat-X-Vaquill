# Chat with citations (W4)

Written 2026-10-23. Part of the Legal Workspace (`/workspace/chat`), Acts only. Everything here runs on free plans; paid switches are in `docs/PAID-SWITCHOVER.md`.

## What it does (updated in W4b: steps 1b, 2 and 4 are new)

1a. **Rewrite the question (W4b).** One cheap call (`queryRewrite`, `gemini-3.5-flash-lite`) turns the question into 2-3 search queries: the question in legal terms, and the Acts and sections most likely to answer it ("Indian Contract Act section 11"). If the model is busy the step is skipped and the answer page says so.
1. **Retrieve.** The question goes to the Acts search: exact section lookups named in the question ("section 138 of the NI Act") first, then search by meaning over Central + State Acts (`src/lib/chat/retrieve.ts`; the same search as the Acts tab, with the keyword fallback). The question and each rewritten query are searched (one batched Voyage request for all of them), "<Act> section N" queries are run as exact lookups, the lists are merged (a section found by several queries rises) and de-duplicated: up to 10 sections, each with its text (first 2,600 characters sent).
2. **Answer.** The model is told to answer only from the numbered sources, cite `[n]`, name the statute and section in words, say plainly when the sources do not answer, and say that judgments are not included yet (`src/lib/chat/prompt.mjs`). The answer streams.
3. **Citations are checked, not trusted.** After the answer, any `[n]` that is not a retrieved source is removed (`sanitizeCitations`). In the browser, `[n]` becomes a numbered chip linking to the exact section page, and "Section 138 of the Negotiable Instruments Act" is linked only when a retrieved source has that section of that Act (`linkSegments`); ambiguous mentions are left as plain text.
4. **Answer check (honest labels, W4b).** A second, cheap call reads the question, the answer and the sources. Labels: **Supported** only when the answer is complete and every claim is backed; **Partly supported** when some claims lack support (they are listed); **Check sources** when the answer is incomplete or the sources only partly cover the question (what is missing is listed); **Not found in the Acts** when the answer says it could not find it (no model call needed). No percentages. If the check cannot run the label is "Check sources" with a note, never blank.
4b. **If the model fails mid-answer (W4b)** the partial answer is kept and marked "The answer was cut off. Try again." (the question still counts; if it fails before any text, the user sees "Busy" and nothing is counted).
5. **Saved.** Title, messages, citation metadata (no section text, no embeddings) and the check result go to the main Neon database (`chats`, `chat_messages`, `chat_usage`; `scripts/chat/chat-schema.sql`), keyed to the anonymous browser id. Only the browser that made a chat can open or delete it.

## Honest limits shown in the UI
"Searches Indian Acts only. Judgments are not included yet. Not legal advice." under the box; "Testing phase: don't enter confidential client information." at the top (Gemini free-tier prompts may be used by Google to improve its products); "Your chats are saved on this browser only." in the sidebar.

## Limits (config in `src/config/chat-limits.json`, env `CHAT_LIMIT_*`)
30 questions per browser per day, 150 per rolling 7 days, 3,000 per month across all browsers (India time; one "chat" in the brief is counted as one question asked). A question that fails on the model side is not counted. When Gemini is busy (HTTP 429, 5xx, a model silent for 12 seconds) the next model in the fallback list is tried; if all fail the user sees "Busy, try again in a minute." and the question is put back in the box.

## Models (free tier, measured 2026-10-23 with this key)
See section 4 of `docs/PAID-SWITCHOVER.md` for how to switch. Free-tier limits come from Google's own 429 messages (the docs page shows them only after sign-in): `gemini-3.5-flash-lite` 15 requests per minute, `gemini-3.6-flash` 5 requests per minute. Daily limits are not shown until reached and were not measured.

## Model choice (2026-10-23)

| Task | Model (config) | Why | Free-tier limit measured |
|---|---|---|---|
| Chat answer | `gemini-3.6-flash`, fallback `gemini-3.5-flash-lite`, gives up on a silent model after 12 s | More complete answers than lite on the same 12 questions (61 cited statements vs 31) | **5 requests/minute** (Google's 429: "limit: 5") |
| Answer check | `gemini-3.5-flash-lite`, fallback `gemini-3.6-flash` | Fast and cheap, JSON output | **15 requests/minute** ("limit: 15") |
| Drafting, review, re-run | placeholders on the same models | Features not built yet | same |

Rejected: `gemini-3.8-flash` (110 s to first token on the free tier, and it rejects the "minimal" thinking level), `gemini-3.1-flash-lite` (12 s), `gemini-2.5-flash` and `-flash-lite` (HTTP 404, no longer available to new users). Daily limits are not shown until they are reached and were not measured. Each question is two calls (answer + check), so with the free limits the site handles roughly 5 questions a minute at full quality and about 7 in total before everything is on lite.

## Tests (run locally on port 3100, real Gemini and Voyage, 12 questions)

| # | Question | Main citations | Label | Cited sections support the claims? |
|---|---|---|---|---|
| 1 | What is the punishment for cheque bounce? | NI Act s138 | Supported | Yes: 2 years, twice the cheque amount, 6 months, 30 days, 15 days are all in s138 |
| 2 | Notice period before filing a cheque bounce complaint | NI Act s106, s105, s142 | Supported | It says "I couldn't find" the notice period: honest, but a **retrieval miss** (s138's 30-day rule was not among the 8 sections). Asked as "Section 138 NI Act: time limit for notice" it finds the 30 days |
| 3 | Can a minor enter a contract? | NI Act s26 | Supported | Claims are backed by s26, but the answer is **incomplete**: Indian Contract Act s11 was not retrieved |
| 4 | Maharashtra rent control: grounds for eviction | Maharashtra Rent Control Act s16 | Supported | Yes (10 cited statements, every number found in the text) |
| 5 | How can I get anticipatory bail? | CrPC s438, BNSS s482 | Supported | Yes (7 days' notice, factors, conditions all in the text) |
| 6 | Time limit to reply to an RTI application? | RTI Act s7, s24 | Supported | Yes (30 days, 48 hours, 45 days). The first run answered "Busy, try again in a minute" (the model failed mid-answer); the rerun worked |
| 7 | Grounds for divorce under the Hindu Marriage Act? | HMA s13 | Supported | Yes (14 cited statements) |
| 8 | What does section 138 of the NI Act say? | NI Act s138 (found by the exact lookup) | Supported | Yes |
| 9 | Can a tenant in Karnataka sublet? | Karnataka Rent Act s32, s33 | Supported | Yes |
| 10 | Is an unstamped document admissible in Maharashtra? | Maharashtra Stamp Act s34 | Supported | Yes (2% a month, 4 times cap, criminal-court exception all in s34) |
| 11 | What did the Supreme Court hold in Arnesh Kumar? (outside the data) | none used | Supported | **Passes**: "I couldn't find ... Court judgments and case law are not included" (nothing invented) |
| 12 | Who won the 2011 cricket world cup? (not law) | none used | Supported | **Passes**: says it could not find it in the Acts |

Automated check of every cited statement (61 in the 3.6-flash run): each number or number-word in a cited sentence must occur in at least one section it cites. 0 failures (the 7 hits were only the year in an Act's name, which comes from the Act title, not the section text). "Supported" on all 12 is the checker's verdict; the two weak answers (2 and 3) are weak because of retrieval, not because of an invented claim. Next step if wanted: let the model rewrite the question into search terms before retrieving (one more cheap call), and retrieve more than 8 sections.

| Area | Test | Result |
|---|---|---|
| Password | Not logged in: pages redirect to the password page, APIs return 401 | Pass |
| Password | Wrong password: "Wrong password, try again." after about one second (no hint, no lockout, no attempt limit). The earlier 5-attempts-per-15-minutes lockout was removed afterwards (see below) | Pass |
| Password | Right password: cookie set (httpOnly, SameSite=Lax, 30 days, `Secure` when the request is HTTPS), lands on the page asked for; tampered or forged cookie rejected | Pass |
| Password | Cookie persists across requests; logout clears it; the browser id cookie survives logout | Pass |
| Password | Production build with `ACCESS_PASSWORD` empty: every page and API returns 503, the password page says "Site not configured", login refused | Pass |
| Chats | Another browser cannot read or delete a chat (404), also with a spoofed `x-lb-bid` header | Pass |
| Limits | Daily limit set to 2: third question gets 429 "You have reached today's limit of 2 questions. It resets tomorrow." Weekly and monthly caps are unit-tested only | Pass |
| Gemini busy | Model answering 429 (stub), no fallback: "Busy, try again in a minute." (stream error, no crash); the question is not counted and no chat is left behind | Pass |
| Gemini busy | Real free-tier burst: 20 simultaneous calls to lite gave 19 OK and one 429 ("limit: 15"); 14 to 3.6-flash gave 6 OK and 8 429 ("limit: 5") | Measured |
| Input | 2 characters: 422; 1,001 characters: 422; bad chat id: 404 | Pass |
| Phone | Chat page at 375 px wide | Fits, no sideways scroll |

**Main Neon database after the tests:** 692 MB (unchanged); the three chat tables took 272 kB for 27 chats and 54 messages (about 10 kB per chat with indexes). Test chats were deleted afterwards.

**Change after the first W4 commit:** the wrong-password lockout was removed. A wrong password is answered after about 1 second with "Wrong password, try again."; there is no other limit. The signed 30-day cookie, logout and fail-closed behaviour are unchanged.


## W4b: the 12 questions again (labels, query rewrite)

Run 2026-10-23 through the real route (real Gemini and Voyage).

| # | Question | Citations used | Label | Notes |
|---|---|---|---|---|
| 1 | Punishment for cheque bounce | NI Act s138 | Supported | |
| 2 | Notice period before filing a cheque bounce complaint | NI Act s138, s142 | Supported | **Fixed**: the rewrite names "Negotiable Instruments Act section 138", which is now an exact lookup (before: "couldn't find") |
| 3 | Can a minor enter a contract? | Indian Contract Act s11 | **Check sources** | **Retrieval fixed** (s11 first, s68 also found). The checker says the answer does not state what happens to a minor's contract, which s11 alone does not say |
| 4 | Maharashtra rent control: grounds for eviction | Maharashtra Rent Control Act s16, s19 | Supported | |
| 5 | How can I get anticipatory bail? | CrPC s438, s38; BNSS s482 | Supported | |
| 6 | Time limit to reply to an RTI application | RTI Act s7, s5 | Supported | |
| 7 | Grounds for divorce, Hindu Marriage Act | HMA s13, s13B, s4 | Supported | |
| 8 | What does section 138 of the NI Act say? | NI Act s138 | Supported | The rewrite step was skipped (model busy) and the page said so; the exact lookup still found s138 |
| 9 | Can a tenant in Karnataka sublet? | Karnataka Rent Act s32 | Supported | |
| 10 | Is an unstamped document admissible in Maharashtra? | Maharashtra Stamp Act s34 | Supported | First run: "Busy" (both models silent for 12 s). Fixed by giving the last model in the chain its full timeout; rerun worked |
| 11 | What did the Supreme Court hold in Arnesh Kumar? | none | **Not found in the Acts** | Says judgments are not included |
| 12 | Who won the 2011 cricket world cup? | none | **Not found in the Acts** | |

Labels now vary: 9 Supported, 1 Check sources, 2 Not found. Mechanical check of the cited statements (41): no number or number-word is missing from the cited section text; the 5 hits are section numbers named in the claim ("under section 13") which come from the section's metadata. "Supported" is still the checker model's judgment, not a proof: question 4 (eviction grounds) and 5 (bail) were judged complete, which a lawyer should confirm.

Other W4b tests: the cut-off path (a model that drops the connection after the first part): the partial answer and its citation chip stay, the note "The answer was cut off. Try again." shows, nothing is lost, the message is saved with the flag, and the question counts. Rewrite skipped (model answering 429): the page shows "Search help was skipped because the model is busy, so the sections found may be less complete." and the answer still arrives.

**Free-tier budget now:** each question is up to three model calls: rewrite (lite), answer (3.6, falling back to lite), check (lite; none for "not found"), and one Voyage request (all queries batched). With lite at 15 requests a minute and 3.6 at 5 a minute that is roughly 5 full-quality questions a minute across all users.
