# law-mapping.json

The one table behind the "Old law to new law" page (`/workspace/browse/old-to-new`). Read it only through `src/lib/acts/lawMapping.mjs`.

**`laws`**: the six Acts (`ipc`, `crpc`, `evidence`, `bns`, `bnss`, `bsa`) with display label, name, `actId` in our data, and which Act replaces / is replaced by it. Taken from `repealed-acts.json`; a test checks they agree.

**`rows`**: one row per old section.

| field | meaning |
|---|---|
| `old_law`, `new_law` | keys from `laws` (`ipc`→`bns`, `crpc`→`bnss`, `evidence`→`bsa`) |
| `old_section`, `new_section` | text exactly as cited, e.g. `"304B"`, `"103(1)"`. Lookup uses the number before any `(...)` |
| `old_title`, `new_title` | section headings |
| `status` | `verified` only if this repo itself states the mapping and `source` names where; otherwise `unverified` |
| `source` | where the row came from (a repo path for verified rows) |
| `what_changed` | optional plain-language note; the page shows it only if present. Never fill it from memory |
| `old_in_data`, `new_in_data` | optional `true` once someone has checked that section exists in our Act data; the page links the section only then. Absent means unknown, so no link |

To add a row: append an object with every required field, no duplicate (`old_law`, `old_section`), and run `npm run test:extract`. Do not mark a row `verified` from memory.

Current state: the repo states Act-to-Act pairs only, so all section rows are `unverified` (title and section numbers recalled, not checked against the Acts data).
