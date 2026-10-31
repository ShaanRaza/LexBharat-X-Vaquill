# Ask evaluation: results

End-to-end scorecard: a question goes through the real `/api/chat` (query rewrite, search, answer) on a local server and is scored 0-3: the expected section is among the sources the model saw (+1), the answer cites it with its [n] (+1), a judge says the legal answer is right (+1). Model: free Gemini (`gemini-3.5-flash-lite`) for the chat, the rewrite, the check and the judge. No OpenRouter credit is used. One run per configuration, one judge model: small differences (a point or two) are noise.

Expected sections: `docs/eval/questions.json` (51 easy questions: 50 from `docs/search-eval/questions.json` + theft) and `docs/eval/questions-hard.json` (28 harder ones; **the expected sections are drafts, not yet checked by a lawyer**). Raw per-question rows are in `docs/eval/runs/`.

## Reproduce

```
scripts/eval/serve.sh                                   # server on :3100, free Gemini only, Voyage vectors cached
node scripts/eval/e2e.mjs <label>                       # main set -> docs/eval/runs/<label>.json (resumes)
node scripts/eval/e2e.mjs <label> --set hard            # hard set
scripts/eval/daily.sh <label> CHAT_TUNING_CURRENT_LAW=1 # one daily subset run with a switch on
```

The free Gemini quota is 500 requests a day for this model, so a full 79-question run is about one day of quota. Each daily run uses the 5 main questions that lost points, 8 fixed controls and the 28 hard questions (about 41).

## Main set (51 questions)

| Run | Score | Shown to model | Cited | Judged right | Notes |
|---|---|---|---|---|---|
| baseline (sources cut at 3,500-4,000 chars) | 147/153 | 51/51 | 50/51 | 46/51 | theft (q51) wrong: the punishment clause starts at char 5,472 |
| **fix (a): whole sections (9,000 chars)** | **151/153** | 51/51 | 51/51 | 49/51 | **kept**; q19, q22, q41, q51 now pass; no regression |

## Hard set (28 questions), baseline with fix (a)

58/84. Expected section shown 19/28, cited 19/28, judged right 20/28, 5 "could not find" (4 of them correct: the not-found questions).

| Group | Score |
|---|---|
| plain language (8) | 18/24 |
| Hinglish (6) | 13/18 |
| two-Act (5) | 9/15 |
| BNS versus IPC (5) | 6/15 (answers that name the old section as the old law: 1/5) |
| must be "not found" (4) | 12/12 |

What fails: a repealed IPC section outranks BNS (q120 murder, q122 498A, q124 theft), the second Act of a two-Act question is missing (q117, q118), Hinglish FIR/dowry retrieve CrPC/IPC instead of BNSS/BNS (q110, q112), and the Transfer of Property Act s.106/108 text is garbled in the data (q101).

## Pending (one change at a time; a change is kept only if the score rises)

| Change | Switch | Status |
|---|---|---|
| (b) hybrid keyword search + statutory rewrite | `hybridSearch`, `statutoryRewrite` | **kept (on)**: hard set 58 -> 62 of 84 (Hinglish 13 -> 18 of 18, plain 18 -> 20, two-Act q118 0 -> 3), main subset 37 -> 37; lost q119 and q121 (3 -> 0 each: unrelated Acts pulled in). One run. |
| (b2) follow-up to (b): why q119/q121 fell to 0 | (general fixes, no switch) | **kept**: q119 0 -> 3, q121 0 -> 3 (hard subset 16/18; 13 controls 36/39 vs 37/39). Causes: with the rewrite skipped ("busy") nothing read "IPC 420" as a lookup, and keyword hits on short units of unrelated Acts (section-1 stubs) outranked the real sections; the statutory rewrite also stopped naming the Arbitration Act. Fixes: bare "IPC 420" / "302 IPC" are section lookups; keyword hits only boost meaning/exact matches and add at most 2 of their own at the end; the rewrite keeps every Act, number and part the user wrote; sections the rewrite names survive narrowing. The two lost points (q41 3 -> 2, q101 2 -> 1) are not retrieval: the expected section was still rank 1 in both; the answer or the judge varied (one run each). |
| (c) current law first ("previously IPC s.379") + answer rules (answer first, related provisions only if they apply) | `currentLaw` | coded and unit-tested, not yet evaluated |
| (d) citation-number check | `citationCheck` | coded and unit-tested, not yet evaluated |

A full 79-question confirmation run follows the last kept change.

## Scorer changes on Oct 29 (runs before and after are not directly comparable)

- Hard set now has 34 questions (129-134 added; 130 is not scored because Hindu Succession Act s.6 is missing from our data). Some expectations accept alternatives (101, 104, 106, 113, 115, 129, 131), 101 must mention State rent-control law, 134 must not cite NI s.94, 105, 106 or 63.
- New check on every question: an answer that opens with "I couldn't find..." although the expected section was shown is not "judged right".
- Rows now keep the full source list (`sources`), so later scorer changes can be re-applied without re-running.
- Consequence: tomorrow's (c) run is compared with a fresh baseline run of the same questions under the new scorer, run first the same day.

## Search-only checks (10 queries, no AI call; `docs/eval/search-checks.json`, `scripts/eval/search-check.mjs`)

The expected section must be within the first 3 results (rank 1 for the bare lookup "138 NI Act").

| Run | Pass | Notes |
|---|---|---|
| before (Search as of Phase 5) | 8/10 | "notice after cheque bounces": s.138 at rank 4 (s.106, s.93, s.30 above it); "IPC 420 cheating punishment": BNS s.318 not in the results |
| after | **10/10** | everyday words get their statutory words (`src/config/search-synonyms.json`), a section whose heading uses the user's own words is lifted, keyword hits lift a result up to 3 places, a section named inside the query is looked up first, a repealed section's replacement leads and is found from the old heading, the same section filed twice is one result |

Two intermediate runs are in `docs/eval/runs/search-after.json` and `search-after2.json` (9/10 with one different failure each); the final is `search-after3.json`.

The final confirmation run is 85 questions (51 main + 34 hard); 84 are scored (q130 is not scored until Hindu Succession Act s.6 is loaded).

## How often the evaluation used vectors (Oct 30)

Until now the rows did not record whether a retrieval used search by meaning or fell back to keywords. Method for the stored runs (`node scripts/eval/vector-share.mjs`): the evaluation server caches every query vector Voyage returns (`docs/eval/.cache/embed.json`) and nothing when Voyage fails, so a search query meant for vectors with no cached vector must have fallen back. Result over the 7 stored runs (190 questions, 690 queries meant for vectors): **690 have a vector, 0 are certain fallbacks.** This is an upper bound, not a measurement: the cache fills across runs, so a query that failed in one run and succeeded in a later one is counted as used. (The oldest runs embedded the query as typed; the synonym expansion came later, so both keys are tried.) From now on each row has `meaning` ({used, fellBack, judgmentsFailed} per question) and the run summary prints the share, so the next baseline gives the exact figure.

## Answer quality on three weak classes (Oct 30-31): multi-Act, old law vs new law, plain language, plus the foreign-law safeguard

What changed (general rules, nothing tuned to a single question): the rewrite makes one query per Act or issue and each Act keeps a minimum share of the sources; a confirmed old-to-new section mapping (`src/config/law-mapping.json`, only rows both Government tables agree on) lets the answer name the current law and the old section; concept-to-Act hints in the rewrite layer for plain-language questions; a question about foreign law (a foreign case, statute or court that is not in our sources) must open with "I couldn't find this in the sources", may then add one related Indian provision labelled as such, and never describes the foreign law. `currentLaw` is on (`src/config/chat-tuning.json`).

Same scorer, same questions as the baseline `base-oct30-*`, free Gemini only (evaluation keys, never the live key), one run each.

| Set | Baseline | Final | By type (baseline → final) |
|---|---|---|---|
| Main (13 questions) | 37/39 | **39/39** | no type split |
| Hard (33 scored) | 78/99 | **89/99, a composite** | old law vs new law 9→14/15, two-Act 9→13/15, plain 19→20/24, short 0→2/3, defamation 2→3/3, Hinglish 18→16/18, must say not found 12→12/12, constitutional / consumer / workplace 3/3 each |
| Held-out (20 questions) | 39/60 | **48/60, probably optimistic** | old law vs new law 13→18/21, two-Act 13→16/21, plain 13→14/18 |

**The hard-set 89/99 is a composite.** Only q125-q128 (the "must say not found" type) were run on the final code (Oct 31). The other 29 of the 33 questions come from earlier runs of this work (`after2-hard`, `after2c-hard`), made before the foreign-law safeguard and before the canonical-filing fix; they have not been re-run on the final code. The "must say not found" type is 12/12 on the final code. The first q126 run scored 0: the foreign-law answer cites one Indian section in its related paragraph, and `detectNotFound` treats a long cited answer as not "not found"; fixed once in `detectNotFound` (commit 8817cf0, class test added) and q126 re-run: 3/3.

**The held-out +9 is probably optimistic.** The 20 held-out questions (`questions-heldout.json`, ids 201-220) were written before the work and never used for scoring during it, but the concept hints were written knowing which topics the held-out set covers. Treat the gain as an upper bound.

**Known drops, no tuning for them** (all on the hard set, compared with the baseline): q112 (Hinglish dowry, 3→2) and q113 (Hinglish non-bailable bail, 3→2): not investigated, possibly answer or judge variation; q118 (two-Act, cruel husband, 3→1): the rewrite did not name BNS s.85 (the rewrite is model-sensitive). They stay as they are; nothing in the code or the config was adjusted for any individual hard question. No question got worse in the main or held-out sets.

**Noise.** One run per version. Differences of one or two points (main +2, held-out plain +1, hard Hinglish -2, q112/q113) may be noise; the larger movements (old law vs new law, two-Act) are not of that size. The old question sets are kept unchanged for the next run.

Mapping review lists: `docs/MAPPING-REVIEW.md` (regenerated Oct 31 by `scripts/concord/review-lists.py`: 1,230 rows, 1,083 pairing-confirmed, 919 linkable, 827 strictly verified).

Foreign-law detection (Oct 31): comparison and mixed questions that also name an Indian side ("How does the DPDP Act differ from GDPR?") are answered from our sources and are not replaced by the safeguard; the rule lives in `src/config/foreign-law.json` (`indian` cues), tested with 12 mixed questions and 4 same-named foreign Acts.

### After merging `origin/reskin` and `reskin-fix3` f64013c (Oct 31, evaluation key only, one run each)

| Run (code) | Main (13) | Not found (q125-128) |
|---|---|---|
| `final-*` (before the merge) | 39/39 | 12/12 |
| `merged-*` (after the merge) | 37/39 (q22 3→2, q25 3→2) | 12/12 |
| `m2-*` (after the one-line-per-section fix below) | **36/39** (q22 2, q25 1) | 12/12 |

**q22 cause and fix (a general rule).** After the merge the answer to "punishment for defamation" got extra lines "The old law this replaced: section 499 … / section 501 …" beside the model's own sentence "replaced section 500". They came from `missingMentions` (`src/lib/chat/concordance.mjs`), which added every confirmed old section the answer did not name, one line each. Fix: ONE line per section and Act, built from all its confirmed counterparts ("Section 356 of the Bharatiya Nyaya Sanhita, 2023 replaces sections 499, 500, 501 and 502 of the Indian Penal Code, 1860."), including those the answer already names; nothing is added when the answer already names the full set. Tests: BNS 356 (one-to-many, with and without the model naming one), BNS 115, BSA 63, BNSS 173, IPC 302 and CrPC 154 (both directions), plus a class test over nine sections. The fix did not change q22's score (2/3 again): the answer in `m2-main` states the right punishment (simple imprisonment up to two years, fine, community service, BNS 356) and has no extra old-law lines, and the judge still marked it wrong. The judge is the same free model and sees the first 7,000 characters of the section; I could not find a defect in the answer, so q22 looks like judge variation (it was judged right in `final-main`), but this is not proven.

**q25 (possible noise, nothing tuned for it).** In `m2-main` the expected section (CrPC s437, the State-filed copy named in `questions.json`) was not among the sources (retrieved false, 1/3) because the query rewrite produced a different fourth query ("… section 478 maximum period for which undertrial prisoner can be detained") instead of one naming CrPC 437; in `final-main` and `merged-main` it was retrieved at rank 8 and 7. The rewrite is model-sensitive (one run each). The scorer also accepts only that one filing of the CrPC. Marked as possible noise.

Main is below 38/39 on the merged code, so nothing was pushed from this run.

### Is the main-set drop real? Repeats and a fairer scorer (Oct 31, evaluation key only)

**Repeats of q22 and q25, three runs each, same scorer and judge** (the merged code = commit 65c603c; the pre-merge code = 0e7ccf8, run from a separate worktree; only the server differs):

| | q22 run 1 / 2 / 3 | q25 run 1 / 2 / 3 | q22 + q25 per run |
|---|---|---|---|
| Pre-merge code (0e7ccf8) | 2 / 2 / 2 | 3 / 3 / 3 | 5 / 5 / 5 |
| Merged code (65c603c) | 2 / 3 / 2 | 3 / 2 / 3 | 5 / 5 / 5 |

q22 is 2/3 on both code versions in 8 of 9 runs (the judge marks a correct answer wrong; the single 3/3 before the merge in `final-main` was the outlier) and q25 flips between 3 and 2 with the judge on the merged code. Same average on both: **the drop is noise, not an effect of the merge.** (Decision rule agreed with the owner: both swing the same way, so noise.)

**Scorer change (a general rule for all questions).** The expected section was matched only by the exact Central filing (`a.category = 'central'`, one `act_id|section_key`). The database holds about 15 filings of the Code of Criminal Procedure (State re-publications of the same Central Act), so a retrieval of another filing of CrPC s.437 (titled "The CRPC 1973") counted as "not retrieved" (q25: 1/3 in `m2-main` although the right provision was among the sources). Now any filing of the same Act's section satisfies an expectation: same section number, the question's anchor sentence in its text, and an Act title with the same year or no year (`scripts/eval/gold.mjs`, shared by the live scorer `e2e.mjs` and the re-scorer `rescore.mjs`; a different Act such as BNSS never counts because its year differs). A re-score can only add, never remove. Tests: `scripts/eval/gold.test.mjs`.

Old and new scores side by side (all 18 stored runs re-scored without calling any model; the stored files themselves are unchanged; only runs where something changed are marked):

| Run | Old | New | Changed |
|---|---|---|---|
| base-oct30-main | 37 | 37 | none |
| c-current-law-main | 37 | 37 | none |
| after-main / after1-main | 33 / 33 | 35 / 35 | q25 1→3 |
| after2-main | 36 | 37 | q25 1→2 |
| final-main (before the merge) | 39 | 39 | none |
| merged-main | 37 | 37 | none |
| **m2-main (merged code + one-line fix)** | 36 | **38** | q25 1→3 |
| base-oct30-hard, c-current-law-hard, after-hard, after1-hard, after2-hard, after2c-hard | 78, 71, 81, 81, 37 (20 q), 53 (20 q) | same | none |
| heldout-before, heldout-after, after1-heldout, final-heldout | 39, 49, 49, 48 | same | none |

The baseline main run (37) is not changed by the new scorer, so the comparison with the baseline stays fair: main is 37 → 38 on the merged code with the new scorer (39 before the merge; the repeats above show the 1-point differences are noise). Not found: 12/12.
