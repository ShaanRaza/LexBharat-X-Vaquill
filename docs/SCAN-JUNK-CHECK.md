# Scan-junk label

A section stored as "complete" whose text came out of the scan as broken words ("Wherc h c landlord obtains dclivery of possession") is shown as **Possibly incomplete**.
It changes the **label only**: no section is hidden or removed from chat sources, search or the Library, and the stored data is not touched.

- Rule (`src/lib/acts/scanJunk.mjs`): of the lowercase words of four or more letters in the first 4,000 characters, at least 6 AND at least 20% are not in the known-word list. Capitalised words are not counted. Texts with fewer than 12 such words are not judged.
- Applied where a label is computed from text (`effectiveStatus` in `src/lib/acts/contentsList.mjs`): the selected section on the Act page, the cited page, search results (from the snippet), chat sources (from the full text), the sections list used by drafting and review. The Act page's section list and its counts still show the stored status for sections whose text is not loaded there.
- Word list (`src/config/known-words.json`, one string of 28,417 words, about 245 KB): rebuild with `DATABASE_URL=<read-only Neon URL> node scripts/text/build-known-words.mjs [--dict /usr/share/dict/words]` (about 8 minutes, read-only). A word is on the list when it is an English word (general English word list, with plural/-ed/-ing/-ly style endings) that occurs in at least 2 sections, or occurs in at least 40 different Acts (legal and Indian terms). The English word list is only used while building and is not stored in the repo.

## Review by eye
- First list (words occurring in at least 8 of 40,000 sampled sections): 40 flagged sections, 20 central, looked at one by one: **11 of 40 were real law text** (Schedule lists of crops, goods, chemicals, diseases; "ginger", "differential", "polyvinyl" were not on the list). More than 2, so the list was rebuilt as above.
- Final list: another 40 flagged sections drawn at random (20 central, 20 state): **1 of 40 was real law text** (central, a Schedule of shellfish diseases with Latin and technical names). The other 39 were scan damage.
- Estimated reach: of 60,000 sampled sections, 1,337 (2.2%) are flagged; 937 of them are stored as "complete", about 3,300 of 211,315 sections. Central Acts: 74 of 12,380 sampled sections (0.6%), mostly old repealed Acts.
