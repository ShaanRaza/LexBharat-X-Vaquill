# Acts Phase 1: real act-level legislation metadata

Added 2026-10-20. The Acts tab of `/workspace/browse` now serves **real** data from the open-india-law snapshot `v2026.08` (CC BY 4.0, Vaquill's published open dataset, not their private API). Judgments, regulators and section text are **not** part of this phase.

## What is real, what is not
| Item | Status |
|---|---|
| 10,112 acts (1,568 central, 8,544 state/UT) | Real, from `in_*_legislation.parquet` (37 files) |
| Regulators (12,152 more acts in `in_*_regulations.parquet`) | Excluded on purpose |
| Section text | Not exported, not shown. No chunk is ordered or concatenated anywhere. |
| Judgments tab, court counts | Still display/mock data. The page says so. |

## Field mapping (`ActItem`)
| Field | Source | Notes |
|---|---|---|
| `actId` | `act_id` | Unique across files (0 cross-file duplicates). |
| `title` | `title`, trimmed | HTML entities decoded for 7 acts (`&quot;`, `&#x2F;`). Nothing else edited, typos kept. |
| `year` | `year`; else first 4-digit year in the title (20 acts) | `null` for 358 acts. Typed `number \| null` for this reason. |
| `category` | `jurisdiction` | `central` or `state` (UTs count as `state`). `regulatory` does not occur in Phase 1. |
| `state` | `state` slug | e.g. `west-bengal`. Absent for central acts. |
| `department` | none | Absent (0% in legislation files). |
| `actNumber` | title pattern `N of YYYY` | Only when YYYY equals the act's year. 940 acts, else absent. |
| `actStatus` | `act_status` | `in_force` 9,392, `repealed` 710, `spent` 10. |
| `enactmentDate` | none | Absent. No such field exists. |
| `citation` | the title | Constructed. The dataset has no act citation. |
| `sectionCount` | distinct non-blank `section_number` per act | Independent of chunk order. **0 means "not countable"** (1,230 acts, 12%, have no section numbers), shown in the UI as "section count unavailable". |

Total counted section numbers: 208,390 (the earlier 211,556 figure counted blank numbers as one section).

## How it fits together
- `scripts/acts/export-legislation.sh` (+ `.sql`) reads the SSD parquet with the DuckDB CLI and writes `src/data/acts/acts.legislation.json` (2.7 MB) and `acts.legislation.meta.json`. Re-run it to regenerate. The SSD is never needed at runtime.
- `src/lib/acts/`: `ActsStore` interface (`types.ts`), shared query logic (`query.ts`), `jsonStore.ts` (real), `mockStore.ts` (fallback), `index.ts` (selector).
- `GET /api/acts/list`: same params and response shape as before plus `source: "real" | "mock"`. `GET /api/acts/stats`: counts, filter values, attribution, caveats.
- `GET /api/mock/acts/list` still exists unchanged in behaviour.
- **Fallback flag:** set `ACTS_SOURCE=mock` to serve the placeholder rows (UI labels itself as mock). Default is real.
- Attribution, licence, snapshot and caveats are shown under the list.

## Later (not built)
- Postgres: implement `ActsStore` against hosted Postgres; routes and UI do not change.
- Regulators: add their rows with `category: "regulatory"` and `department` (already in the schema).
- Section text: only after a chunk-ordering rule is validated on a sample. Nothing here assumes one.

## Known limits
Duplicate-looking titles exist (159 title groups with more than one `act_id`, kept as separate rows). The Delhi file includes state amendments of central acts. Data quality is that of the source files; not legal advice.

> Update: regulators were added in Phase 3 and judgments metadata in Phase 2. See `docs/ACTS-PHASE2-3.md`. The Phase 1 legislation export is unchanged.
