# law-mapping.json

The one table behind the "Old law to new law" page (`/workspace/browse/old-to-new`). Read it only through `src/lib/acts/lawMapping.mjs`.

**`laws`**: the six Acts (`ipc`, `crpc`, `evidence`, `bns`, `bnss`, `bsa`) with display label, name, `actId` in our data, and which Act replaces / is replaced by it. Taken from `repealed-acts.json`; a test checks they agree.

**`rows`**: one row per old section.

| field | meaning |
|---|---|
| `old_law`, `new_law` | keys from `laws` (`ipc`→`bns`, `crpc`→`bnss`, `evidence`→`bsa`) |
| `old_section`, `new_section` | text exactly as cited, e.g. `"304B"`, `"103(1)"`. Lookup uses the number before any `(...)` |
| `old_title`, `new_title` | section headings |
| `status` | `verified` means ALL of: `pairing_confirmed`, and `linkable` (both sections in our data and titles correspond). In the file as first written: `verified` only if (a) this repo itself states the mapping and `source` names where, or (b) both sections were found in our Acts data and their titles and subject correspond, and `source` starts "Checked against our data on <date>:"; otherwise `unverified`. Neither means checked against the official government comparison table |
| `pairing_confirmed` | `true` when BOTH Government documents give this pairing: the NCRB / Ministry of Home Affairs "Corresponding Section Table ... with Repealed Act" (Sankalan portal PDFs) and the CAPT Bhopal correspondence table. Answers may name the replacement section whenever this is `true`. |
| `linkable` | `true` when both sections are in our Acts data (not garbled) AND their titles correspond (at least half the title words shared, or a hand check recorded in the row's `source`). Links, and anything shown as "checked against our data", need this. |
| `tables` | which documents list the pairing: `ncrb`, `capt` |
| `old_text_in_data`, `new_text_in_data` | the section's text is in our Acts data (not garbled). When `false`, an answer that names the section must say its text is not in our data yet. |
| `also_new_sections` | optional: the few old sections that map to more than one new section: `[{ new_section, new_title, new_text_in_data, pairing_confirmed, linkable, tables }]`; the row's own `new_section` is the first. |
| `source` | where the row came from (a repo path for verified rows) |
| `what_changed` | optional plain-language note; the page shows it only if present. Never fill it from memory |
| `old_in_data`, `new_in_data` | `true` once someone has checked that section exists in our Act data, `false` if it was looked for and is not there; the page links the section only when `true`. Absent means unknown, so no link |

To add a row: append an object with every required field, no duplicate (`old_law`, `old_section`), and run `npm run test:extract`. Do not mark a row `verified` from memory.

Rows are built by `scripts/concord/` (`dump-headings.mjs`, `parse_tables.py`, `build-law-mapping.py`), which keeps the hand-checked rows exactly as they are and adds the rest from the two Government documents. Never fill a row from memory. `old_in_data` / `new_in_data` mean "this section may be linked": true only when the row is `linkable`, false when the section is not held, left out when it is held but the titles do not correspond.

First state (checked 2026-10-30 against the Neon Acts data, before the Government tables were added): 34 rows, 31 verified, 3 unverified (CrPC 200 and 482 are missing from our CrPC record; BSA 2 is a damaged record). Each row's `source` says what was found. The SSD copy of the full dataset was not checked.
