# Filling in missing Act sections (519 files, one per section)

**Status 2026-10-24: all 519 sections that were missing or wrong in our data for the 8 Acts (the first 30 and 489 more) are filled from India Code's Act PDFs and loaded.** The steps below are for adding more (copy a file, change the Act, Act ID and Section lines). See `docs/MISSING-SECTIONS.md` (W7) for how the text was extracted and checked.

Each `.txt` file here is one section that is missing or wrong in our data. Everything else is built: when a file is filled and loaded, the section appears on its Act page with "Source: India Code, copied <date>", and Search, smart search, Chat, Drafting and Review all find and use it.

**Only copy text you are allowed to use.** Written permission to republish the India Code text has been received (see `docs/PERMISSIONS.md`; check its "Any limits" column before copying more). A file with an empty text area is skipped: nothing is loaded from it.

## The 3 steps
1. **Open a file** (for example `contract-section-028.txt`). Fill in three lines: `Source URL:` (the web address you copied the text from), `Date copied:` (like `2026-10-24`) and, if you like, `Heading:` (the short title of the section). Leave the other lines as they are.
2. **Paste the section text** under the line `=== SECTION TEXT (paste below this line) ===` as plain text, and save the file. (Leave it empty to skip that file for now.)
3. **Run** `npm run load:supplement` in the `vaquill-local` folder. It checks your files, tells you about any problem in plain words, loads the new or changed ones (a few minutes if there are many, because the free embedding service allows 3 requests a minute) and removes sections whose file you emptied. Run it again any time you add or change a file. To only check the files without loading, run `npm run load:supplement -- --dry-run`.

## Good to know
- The "Topic hint" lines are from memory and not checked. The section **number** is what counts; confirm it on India Code.
- Files marked "Replaces existing text: yes" (CPC sections 11 and 20) are sections where our data holds the wrong text under that number. Your text replaces it on screen and in search; the original rows are never changed or deleted.
- If you change `Source URL` or `Date copied`, the file counts as changed and is loaded again.
- Not sure about a file? Run with `--dry-run` first.

## Orders, Rules and Articles of the Schedules (W8)
`content/supplement/schedules/` holds one file per Order and Rule of the CPC First Schedule, per Article of the Limitation Act Schedule and per Article of Schedule I of the Indian Stamp Act (955 files, written by `node scripts/supplement/fill-schedules.mjs` from the PDFs, every word checked). The "Section" line is `O39R1` (Order 39 Rule 1), `O39` (the Order) or `A137` (Article 137). `npm run load:supplement` reads this folder as well. See `docs/W8.md`.

## The Constitution of India (W9)
`content/supplement/schedules/constitution-*.txt` (512 files: 500 Articles `A21`, `A243ZH` ... and 12 Schedules `S1` to `S12`) come from `scripts/supplement/fill-constitution.mjs`. A file may carry a `Chapter:` header line (the Part / Chapter / cross-heading the unit sits under). See `docs/W9.md`.
