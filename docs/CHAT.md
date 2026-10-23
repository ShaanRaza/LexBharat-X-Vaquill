# Chat with citations (W4)

Written 2026-10-23. Part of the Legal Workspace (`/workspace/chat`), Acts only. Everything here runs on free plans; paid switches are in `docs/PAID-SWITCHOVER.md`.

## What it does

1. **Retrieve.** The question goes to the Acts search: exact section lookups named in the question ("section 138 of the NI Act") first, then search by meaning over Central + State Acts (`src/lib/chat/retrieve.ts`; the same search as the Acts tab, with the keyword fallback). Up to 8 sections, each with its text (first 2,600 characters sent).
2. **Answer.** The model is told to answer only from the numbered sources, cite `[n]`, name the statute and section in words, say plainly when the sources do not answer, and say that judgments are not included yet (`src/lib/chat/prompt.mjs`). The answer streams.
3. **Citations are checked, not trusted.** After the answer, any `[n]` that is not a retrieved source is removed (`sanitizeCitations`). In the browser, `[n]` becomes a numbered chip linking to the exact section page, and "Section 138 of the Negotiable Instruments Act" is linked only when a retrieved source has that section of that Act (`linkSegments`); ambiguous mentions are left as plain text.
4. **Answer check.** A second, cheap call reads the answer and its sources and returns `supported`, `partial` or `check` plus the list of claims the sources do not back. The UI shows "Supported", "Partly supported" or "Check sources" (no percentages) and lists those claims. If the check cannot run the label is "Check sources" with a note, never blank.
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
| Password | Wrong password: "That password is not correct." (no hint); 5 wrong attempts then 429 "Try again in 15 minutes", even the right password from that address | Pass |
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
