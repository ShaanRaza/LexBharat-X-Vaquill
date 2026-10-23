# Semantic search for Central Acts (W2b)

Written 2026-10-23. Search by meaning over Central Acts (W2b) and State Acts (W2c, section 5 onward), using the vectors that open-india-law already ships (voyage-4, 1024-d, in Qdrant `acts_india`). **No document was embedded with Voyage**; only user queries are.

## 1. Central Acts that the dataset filed under States

Rule (`scripts/acts/fix-misfiled-central.mjs`, idempotent, re-run by `load-neon.sh`): a state-filed Act is a Central Act copy when its title and year occur in **4 or more different states**, with no state name and no amendment/repeal wording, and at least one copy has text. **One copy per Act** is moved (the one with the most sections); the other state copies stay as filed. Not moved when Central already holds the Act with at least 80% of the sections. The dataset's own values stay in `acts.raw_category` and `acts.raw_state`; `acts.category_note` records why. 1,568 Central Acts became 1,589.

Moved (21): Code of Criminal Procedure 1973 (442 sections, 14 copies in 8 states), Factories Act 1948, Employees' State Insurance Act 1948, Minimum Wages Act 1948, Payment of Wages Act 1936, Payment of Gratuity Act 1972, Maternity Benefit Act 1961, Consumer Protection Act 1986, Waqf Act 1995, Equal Remuneration Act 1976, Contract Labour (Regulation and Abolition) Act 1970, Beedi and Cigar Workers Act 1966, Industrial Employment (Standing Orders) Act 1946, Building and Other Construction Workers Welfare Cess Act 1996, Building and Other Construction Workers (Regulation of Employment and Conditions of Service) Act 1996, Motor Transport Workers Act 1961, Unorganised Workers' Social Security Act 2008, Forest Conservation Act 1980, Working Journalists Act 1955, Sales Promotion Employees Act 1976, Pre-Conception and Pre-Natal Diagnostic Techniques Act 1994.

Checked and not moved because Central already has them: Indian Penal Code 1860 (533 vs 546 sections), Indian Evidence Act 1872 (175 vs 173), Code of Civil Procedure 1908, Bharatiya Nyaya Sanhita, Bharatiya Nagarik Suraksha Sanhita, Bharatiya Sakshya Adhiniyam (all Central), Payment of Bonus Act 1965, Rights of Persons with Disabilities Act 2016, Real Estate (Regulation and Development) Act 2016. Not moved because they have fewer than 4 state copies or no text: Manipur's draft translations of BNS, BNSS and BSA, and Acts with 1 to 3 state copies (about 190 groups, not reviewed, so more may exist).

## 2. Vectors

Read from Qdrant `acts_india` (Central + the 21 moved Acts): 76,711 points. They are the **original float32 vectors** (about 700 distinct values per vector; an int8 copy has at most 256). Truncated to 256 dimensions and renormalised (identical to asking Voyage for 256; checked earlier), loaded as `halfvec(256)` with an HNSW cosine index into the vector database, table `central_emb_256` (key: `chunk_id`; also `act_id`, `section_key`).

| | |
|---|---|
| Rows loaded | 76,701 (41,578 sections) |
| Not loaded | 10 points whose section is missing from our section text (e.g. NI-style gaps `IND_central_1470 s044`) |
| Table / HNSW / section index | 46 MB / 61 MB / 2 MB; vector database 123 MB of 1 GB |
| 1024-d floats kept outside the repo | `../lexbharat-data/vectors/central-qdrant-1024.f32` (314 MB) + `central-qdrant-chunks.jsonl` |

## 3. 256-d against 1024-d (50 questions, all Central Acts incl. the moved ones; same voyage-4 query embeddings)

| Setup | Top 1 | Top 5 | Top 10 | No result in top 50 |
|---|---|---|---|---|
| 1024-d, Qdrant (int8 index) | 62% | 96% | 96% | 0 |
| **256-d, Neon halfvec** | 56% | **96%** | 98% | 0 |
| 256-d + Acts not in force x0.9 (shipped) | 66% | 98% | 100% | 0 |

Top 5 does not drop (stop condition was more than 4 points). With CrPC now in Central the five previously unanswerable questions can be answered. The x0.9 factor was chosen on these same 50 questions (one parameter, flat from 0.9 down to 0.8), so treat the gain as indicative. Misses: NI Act s138 for the first question (rank 11 at 256-d), Arbitration Act s11 (rank 7). A paced end-to-end run of 10 questions through the real API route gave the same ranks as the offline run.

## 4. How the search behaves

- Default: voyage-4 query embedding (256-d, normal embeddings API, never Batch, never another model, server-side) -> nearest chunks -> distinct sections -> Acts not in force x0.9, garbled sections dropped -> 60 sections, 12 per page (W2b: Central only; W2c: see section 5). Same result format as before, plus a "By meaning" label.
- Keyword search still handles section lookups ("138 NI Act"), "quoted phrases", Hindi, and the "Search exact words instead" link (`exact=1`), and is the way to search exact words in State Acts. (Since W2c, search by meaning covers State Acts too; see section 5.)
- Query embeddings are cached (500, in memory, in-flight calls shared): the same query makes no second Voyage call (cold 2.2 s, repeat 0.3 s).
- 30 searches a minute per address (`429` with `Retry-After`); in memory, so per server instance.
- Without `VOYAGE_API_KEY` or `VECTOR_DATABASE_URL`, or when Voyage fails, keyword search answers with a one-line note (tested: no key, wrong key).
- "Possibly incomplete" labels and notices still show in semantic results.
- Voyage limit: an account without a payment method is held to 3 requests a minute and 10,000 tokens a minute, which a busy site will exceed (searches then fall back to keyword with the note). Adding a payment method lifts it; the free 200M tokens still apply and a search costs about 10 tokens.


## 5. State Acts (W2c)

Same method as Central: the open-india-law `acts_india` vectors for State Acts (original float32, 1024-d) truncated to 256-d and renormalised, no Voyage embedding run.

**Size check before loading:** estimate 778 MB for the vector database (462,618 rows at the Central rows' measured cost); limit set at 900 MB. Measured after loading: **779 MB** (Central 46 + 61 MB, State 278 MB table + 347 MB HNSW + 9 MB section index, rest is Postgres overhead).

| | |
|---|---|
| State points in Qdrant | 469,714 (466,966 after leaving out the 21 Acts moved to Central) |
| Loaded into `state_emb_256` | 462,198 |
| Skipped | 4,768: sections we hide (garbled: 1,819 sections; Hindi-only or near-empty text) and points with no Neon section |

**Ranking with State Acts added.** Adding 462k State vectors first dropped the Central questions (top-5 98% -> 82%) because State look-alikes (State RTI Acts, municipal and civil-court Acts, 8 State filings of CrPC) crowd the list. Three rules fixed it:
1. Filings of the same section of the same Act (same title without year, "The" and "&"/"and" differences, same section number) collapse into one result; the **Central filing wins**, and the result says "N other copies" (CrPC 1973: 13 State copies folded into the Central one).
2. A question that names no State gives Central Acts a x1.3 boost.
3. A question that names a State or UT (`statesIn`, 36 names and spellings) gives that State's Acts x1.2 and Central no boost.

**Test (embedding the questions with voyage-4 at 256-d, same code as the app; Voyage tokens 718):**

| Questions | Setup | Top 1 | Top 5 | Top 10 |
|---|---|---|---|---|
| 50 Central | Central only (W2b) | 64% | 98% | 100% |
| 50 Central | **Central + State (shipped)** | **64%** | **98%** | **100%** |
| 50 Central | Central + State, no boost (for reference) | 40% | 82% | 96% |
| 15 State (`docs/search-eval/state-questions.json`) | State only | 73% | 87% | 93% |
| 15 State | **Central + State (shipped)** | **80%** | **93%** | **93%** |

The 15 State questions are rent control (Maharashtra, Kerala, Karnataka, Telangana), stamp duty (Karnataka, Maharashtra), money-lending and apartment ownership in Maharashtra; every anchor was checked in the stored text. One miss: "Does a leave and licence agreement have to be registered in Maharashtra?" (Maharashtra Rent Control Act s55) is not in the top 60. A paced run of all 15 through the real API route gave top-1 12/15 and top-5 14/15, the same as the offline numbers, and the 10-question Central sample gave the same ranks as before State Acts were added. The boosts were set on these same 65 questions (a flat Central boost of 1.3 to 1.5 gives the same Central numbers; State top-1 80% holds for named-state boosts of 1.1 to 1.3), so treat the exact values as indicative.

**Swappable backends.** `src/lib/acts/vectorStore.ts` is the one interface (`nearest(vector, limit)` per corpus). Each corpus is a Neon pgvector table today and can move to a Qdrant collection by environment variables alone; tested here by serving Central from the local Qdrant (1024-d) and State from Neon (256-d) in one search. See `docs/PAID-SWITCHOVER.md`.

## 6. Regulators (plan only, nothing loaded)

`acts_india` holds **554,354** regulatory points (SEBI, RBI, MoEFCC, Law Commission, MCA, TRAI, IBBI, IRDAI, CPCB and others; all English by language code, many with Hindi text inside).

| Step | Number |
|---|---|
| Sample of 9,932 random regulatory points: Hindi-heavy (20+ Devanagari characters) | 16.9% |
| ... with a U+FFFD replacement character (damaged text) | 5.8% |
| ... near-empty (under 30 characters after the header) | 0.9% |
| **Hidden (any of the above)** | **18.8%** (the dataset's own garbled flags are not published for regulators, so this is a text rule) |
| Vectors to load | about **450,000** (554,354 x 81.2%) |
| Size at 256-d halfvec + HNSW | about **630 MB** (State's measured 1.40 KB per row x 450k) |

Neon's plans page (checked 2026-10-23, https://neon.com/docs/introduction/plans): the Free plan allows **100 projects**, **1 GB per project**, **20 GB across the account**, 100 CU-hours per project per month, up to 2 CU (8 GB RAM). So **a third free project can hold the regulator vectors** (about 63% of 1 GB). Two cautions: the existing vector project is at 779 MB and the main text project at 692 MB, so regulators need their own project; and that project would hold vectors only. The regulator text (about 590 MB for 554k chunks) does not fit beside the vectors, so snippets must come from somewhere else (the Qdrant payload on the search server later, or static files like the Acts text). The app code already allows a separate Neon project per corpus (`VECTOR_DATABASE_URL_<CORPUS>`). Regulators are not wired into the app yet: that needs a `regulator` corpus in `vectorStore.ts` and a place for section text. No account was created.
