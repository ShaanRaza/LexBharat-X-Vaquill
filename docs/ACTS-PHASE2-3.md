# Phases 2 and 3: judgments metadata, regulators, storage seam

> Figures in this file are as of 2026-10-20 (the original export). The current figures are in `docs/DATA-GAPS.md`.

Added 2026-10-20. Source for everything: open-india-law `v2026.08` (CC BY 4.0), exported from the local SSD into small processed files in `src/data/`. The raw dataset is never needed at runtime.

## Phase 2: judgments (metadata only)
| Part | What |
|---|---|
| Export | `scripts/judgments/export-judgments.sh`: per court and decision year, distinct `case_id` (all 26 courts, 15,693,540 case records); one row per Supreme Court case (37,014) split into `src/data/judgments/sc/<year>.json` (76 files, 12 MB). Never reads `text`. |
| Store | `src/lib/judgments/` (`JudgmentsStore`, JSON store, mock store). `JUDGMENTS_SOURCE=mock` or `ACTS_SOURCE=mock` serves the old placeholder court pages. |
| API | `GET /api/judgments/courts`, `/years?court=`, `/list?court=&year=&page=&pageSize=&search=`. Only the Supreme Court is listable; other courts answer `available: false`. |
| UI | Court cards show real counts. Court page shows a year grid with counts; Supreme Court years open a case-metadata list (`CaseList.tsx`). Attribution and caveats are shown. |
| Not included | Judgment text, High Court case lists, tribunals, citations for High Courts (the dataset has none). Year follows `decision_date` when present, else `year`. |

## Phase 3
| Part | What |
|---|---|
| Regulators | `scripts/acts/export-regulations.sh`: 11,240 regulator instruments (RBI, SEBI, MCA, DGFT, TRAI, MoEFCC, CPCB, IRDAI, DFS, CBIC) added as `category: "regulatory"` with `department`. Excluded: tribunal orders (`trib-*`, hash titles) and Law Commission reports (not instruments). The acts list is now 21,352 entries. |
| Section text | Validation run, result not good enough: see `docs/CHUNK-ORDER-VALIDATION.md`. Seam only: `/api/acts/<actId>/sections` always `available: false`. |
| Storage seam | `ActsStore.get/list/stats` and `JudgmentsStore` are the only things routes and pages use. `scripts/db/schema.sql` is the draft Postgres schema for the AWS move; nothing uses it yet. |

## Moving to AWS later (no rewrite)
1. Create RDS/Aurora Postgres; apply `scripts/db/schema.sql`; load from the processed exports (not the raw SSD).
2. Add `src/lib/acts/pgStore.ts` and `src/lib/judgments/pgStore.ts` implementing the same interfaces (needs a Postgres driver: a new dependency, to be approved then). Select with an env var in the two `index.ts` files.
3. Put future section text and High Court case lists in S3 (per-act / per-court-year files) behind the same interfaces.
4. Keep Vercel or move the Next.js app to Amplify/ECS; routes and UI are unchanged.

## Known limits
Regulator entries are often circulars/notifications: 18% have no year, 15% show section count 0. Court coverage is uneven (several High Courts start around 2015; Sikkim has 2,219 records). Case counts are distinct `case_id`, not official totals.
