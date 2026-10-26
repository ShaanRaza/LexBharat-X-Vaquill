# Repeated text in Supreme Court judgments: what it was and what was fixed (2026-10-26)

**Question:** `2005_INSC_103` showed the same "marketability" sentence many times. Is that in the source data, or did our load duplicate chunks?

**Answer: both, in two different places.**
1. **Our load (fixed).** The dataset cuts each judgment into chunks that **overlap by about 350 characters** (the start of chunk N+1 repeats the end of chunk N). We joined the chunks as they were, so that text appeared twice at every chunk boundary. Measured over all 35,596 English cases (`node scripts/w10/sc-overlap-report.mjs`):
2. **The source itself (not fixable by us).** Some printed reports have a text layer that repeats itself. `2005_INSC_103` is this kind: its single English chunk (3,918 characters, no overlap with anything) contains the headnote line "the department had failed to prove marketability…" over and over, in the dataset's own text.

| | Before the fix | After the fix |
|---|---:|---:|
| Cases with chunk-overlap repeats | **33,535** of 35,596 (94%) | 67 |
| Chunk boundaries that repeated text | **210,020** | 68 |
| Characters repeated | **68,123,648** (5.27% of all judgment text) | 11,996 (0.001%) |
| Total judgment text stored | 1,292,831,288 | 1,224,707,640 |
| Cases with source-level repeats (a run of 8 words occurring 3+ times in at least 1% of the case) | 2,375 | 2,375 (unchanged) |
| ...of which 5% or more | 11 (worst: 2024_INSC_134 10.2%, 2016_INSC_1079 7.9%, 2011_INSC_746 6.2%) | 11 |
| Cases with no repeat at all in the overlap sense | 2,061 | 35,529 |

The 67 remaining cases (68 boundaries, about 180 characters each) are places where the end of one chunk and the start of the next match for another reason (a sentence the judgment genuinely repeats); they are left alone because removing text we cannot prove is a duplicate would change the judgment.

## What was done
- `scripts/w10/load-sc.mjs` now removes the repeated start of each chunk when loading (exact match of the end of the previous chunk, at least 60 characters), keeps the chunk numbers (so vectors and links to `#passage-N` still point at the same chunk), and has `--only-changed` / `--full` options.
- **Only the affected cases were reloaded:** 33,535 cases in `sc_cases` (`lexbharat-sc-text`) and the same cases in the word index `sc_kw` (`lexbharat-sc-keyword`, rebuilt from the cleaned text, so a word that only appeared twice because of the overlap is no longer counted twice). The other 2,061 cases were not touched. Vectors were not changed (they are per chunk of the original text).
- Sizes after: text project 500 MB, keyword project 242 MB (both under 900 MB).
- Reader: a judgment's passages now continue where the previous one ended instead of repeating its last lines.

## What is not fixed
The 2,375 cases whose own printed text repeats (11 badly) still show those repeats; they are in the dataset's extraction of the report. A "repeated text in the source" notice on those pages is possible (the report script lists them) but not added.
