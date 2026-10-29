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
