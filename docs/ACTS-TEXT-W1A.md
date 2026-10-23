# W1a: Act section text (local only)

Added 2026-10-23. Shows section text on a new Act page, **only when `ACTS_TEXT_DATA_DIR` is set**. Data: open-india-law `v2026.08` (CC BY 4.0). Scope: Central and State/UT legislation; regulator instruments are excluded.

## Pieces
| Piece | File |
|---|---|
| Build (DuckDB reads the parquet, Node reassembles) | `scripts/acts/export-act-text.sh` (`npm run index:acts-text`), `export-act-text.sql`, `build-act-text.mjs` |
| Reassembly + quality flags (pure logic, tested) | `src/lib/acts/reassemble.mjs`, tests in `reassemble.test.mjs` (part of `npm run test:extract`) |
| Display-only cleanup (letter spacing, markdown) | `src/lib/acts/cleanText.mjs` |
| Flag wording (meanings, no styling) | `src/lib/acts/quality.ts` |
| Reader (server) / view model | `src/lib/acts/sectionText.ts`, `src/lib/acts/viewModel.ts`; API seam `src/lib/sections/index.ts` |
| Page + presentation | `src/app/(console)/workspace/browse/acts/[actId]/page.tsx`, `src/components/workspace/ActTextView.tsx` |
| Shared UI kit and tokens | `src/components/kit/*`, `src/styles/tokens.css` |

Output (outside the repo, never committed): `../lexbharat-data/acts-text/act=<actId>.json.gz` (one per Act), `_index.json`, `_report.json`. Run: `scripts/acts/export-act-text.sh` (about 20 s). Use: `ACTS_TEXT_DATA_DIR=../lexbharat-data/acts-text` in `.env.local`. Without it (production) the page says the text is not published yet and `/api/acts/<id>/sections` answers `available: false`.

## Rules (all computed, none guessed)
- **Order inside a section:** bare chunk, then `_pN` parts, then sub-sections (`_1`, `_2`, ...) each followed by its `_dN` continuations. This is a documented rule, not ground truth; sections where it may be wrong are flagged.
- **Raw text** is stored exactly as in the dataset except the two header lines the dataset adds to every chunk. Display cleanup (letter-spaced words such as "C H A P T E R", markdown) happens at render time only.
- **Status:** `complete` (no problem detected, not proof of identity with the Gazette), `possibly_incomplete` (lost characters, missing `_p` part, skipped sub-section number, mixed piece kinds, a piece whose header names another section, or Hindi pieces left out), `garbled` (mojibake detected, or a section that is only Hindi). Independent flags: `devanagari`, `no_section_number`.
- **Hindi:** every automatic test tried (word-start vowel signs, invalid vowel-sign pairs, word frequency across Acts) missed scrambled samples, so any piece with 20 or more Devanagari characters is treated as unverifiable and is not shown (kept in the raw text). English pieces of the same section are shown. Hindi headings are not shown.
- **Chapter labels** are shown only if: the section's pieces agree, the name is readable (not letter-spaced or garbled), it matches a CHAPTER heading inside the text when there is one, the label forms one contiguous run through the Act (the longest run wins) and chapter numbers do not go backwards. A consistent off-by-one cannot be detected, so passing is not proof.

## Result of the full build (10,112 Acts, 544,078 chunks, 0 unparsed)
| Flag (sections) | Count |
|---|---:|
| Total sections / blocks | 211,553 |
| complete | 179,716 |
| possibly_incomplete | 30,018 |
| garbled (1,798 Hindi-only + 21 detected mojibake) | 1,819 |
| contains Devanagari | 3,075 |
| no section number | 3,166 |

Reasons behind `possibly_incomplete` (a section can have several): mixed piece kinds 28,725; skipped sub-section 3,379; lost characters 2,214; Hindi pieces left out 1,043; missing `_p` part 175. Exact duplicate chunks merged in 13,362 sections. Acts with no section numbers: 1,230 (all single-block repealed Acts); Acts with at least one garbled section: 202. Chapter labels passing all checks: 69,890 of 208,387 sections (the rest are hidden; 96,957 have no label in the data).

Size: 10,112 gzipped files, 124.0 MB (142 MB on disk with the two summary files).
