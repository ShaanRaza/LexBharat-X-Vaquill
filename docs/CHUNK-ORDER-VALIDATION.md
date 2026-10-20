# Chunk-order validation (legislation section text)

Run 2026-10-20 with `scripts/acts/validate-chunk-order.sh` (read-only). **Result: not validated to a production standard. No section text is served.**

## Question
Legislation rows are chunks, not sections, and the files have no `chunk_index`. Can a split section be put back in reading order from `chunk_id` alone?

## What the ids look like (544,078 rows)
Suffix families after the section token: bare (`_s004`), part (`_p0`, `_p1`), definition-style (`_d1`, `_d10`...), numeric (`_6`), and combinations (`_p0_d2`, `_b000_2_d29`). Sorting ids as plain text would give `_d1, _d10, _d11, _d2`.

## Evidence for `_p<N>` (the largest family: 57,989 sections)
- Hand check (Advocates Act s.35): `_p0` ends in clause (d) of sub-section (3); `_p1` starts at sub-section (4). Numeric order is right there.
- Measured proxy: for adjacent parts N and N+1, the first paragraph-start sub-section marker of N+1 should exceed the last of N. Only 10.9% of pairs are testable (both parts contain such a marker). Of those, **90.5% are in order**. The 9.5% may be restarted numbering (provisos, schedules, amendments) or real misorder; the proxy cannot tell.
- Integrity: of 57,989 part families, 11 do not start at `_p0` and 30 have gaps or duplicates, so some sections are missing a part or hold a repeated one.

## Not tested at all
`_d<N>` (about 100k rows), numeric suffixes, bare ids that also have siblings, and `b` (non-section) blocks. There is no ground-truth text to compare with.

## Decision
- No reconstruction runs anywhere. `sectionCount` counts distinct `section_number` values and does not depend on order.
- `GET /api/acts/<actId>/sections` exists but always answers `{ available: false }` (`src/lib/sections`).
- To turn text on later: (1) get a ground truth, for example compare a few hundred acts with the India Code pages named in `source_url`; (2) define and test an order rule for `_p`, `_d` and numeric suffixes; (3) handle the 11 + 30 broken families; (4) implement `SectionsStore` and enable it behind an env flag.
