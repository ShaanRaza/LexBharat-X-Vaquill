# Supreme Court count: 37,014 (ours) vs 34,954 (the dataset's README)

Checked 2026-10-25 against `in_supreme-court_judgments.parquet` (v2026.08) and `src/data/judgments/sc/*.json`. Reports only; no data was changed except the duplicate notice described at the end.

## The two numbers
| What | Count |
|---|---:|
| README table: "Supreme Court of India, Judgments" | 34,954 |
| Distinct `case_id` in the Supreme Court Parquet file (what we list) | **37,014** (1,113,313 text chunks) |
| ... that have an English-language document | 35,596 |
| ... that have a clean English start (exactly one chunk with `char_start = 0`) | 35,592 |
| ... with no English document at all (only Hindi, Punjabi etc.) | 1,418 |
| Distinct citations / distinct case ids in our JSON | 37,014 / 37,014 |
| Duplicate `case_id`s | 0 |

**Finding: the 2,060 difference cannot be reproduced from the files.** I tried: distinct `case_id` (37,014), English only (35,596), English with a clean start (35,592), distinct opening text (35,592: no two cases share an opening), distinct citation (37,014), and English-text length cut-offs (the number of English cases under 3,000, 3,500, 3,800, 4,000 and 4,200 characters is 254, 423, 552, 656 and 767; the 642 needed to reach 34,954 from 35,596 falls between the 3,800 and 4,000 cut-offs, which is not a natural threshold). The README does not say how it counts. The most likely reading is that the README counts judgments in the original AWS Open Data release, before the dataset added or split records, but that is a guess: **I cannot say which of the two is "right"**. What we can say is that every one of the 37,014 is a distinct `case_id` with text in the file, and the README figure is lower than what the file holds.

## Where the 5,178 "year" differences come from
The Parquet `year` column is **not the year of decision** for 5,178 cases: for 5,108 of them it is one year *later* than the decision date, and for 41 it is more than a year off. It is the year of the law-report volume (a judgment of December 1961 printed in the 1962 volume carries `year` 1962). Our lists use the **decision date**: all 37,014 sit in the year file of their decision date (0 mismatches), and the case id's own year equals the decision year for all but 26. So a count "by year" from the Parquet `year` column differs from ours for the 1950s to 1970s, and that is one reason the README's by-year figures can differ.

## The low years: what the data shows (cases per year, by decision year)
| Year | Cases | by report-volume year | by id year | Note |
|---:|---:|---:|---:|---|
| 1981 | 211 | 226 | 211 | |
| **1982** | **104** | 151 | 104 | half of 1981 and 1983 (205) on every measure |
| 1983 | 205 | 174 | 205 | |
| 1994 | 623 | 623 | 623 | |
| 1995 | 914 | 915 | 914 | |
| **1996** | **1,534** | 1,533 | 1,534 | the spike: more than the Court's reported output of other years |
| 1997 | 831 | 833 | 831 | |
| 1998 | 491 | 492 | 491 | |
| 2019 | 1,043 | 1,043 | 1,039 | |
| **2020** | **568** | 568 | 563 | down 46%; the same on every measure |
| 2024 | 744 | 744 | 743 | |
| **2025** | **437** | 437 | 438 | partial year: the latest decision date in the file is 2025-11-06 |

**Explanation, as far as the data allows:** the low and high years are the same whichever year we use, so they are **properties of the source collection (the reported judgments of the Supreme Court Reports / INSC numbering), not a bug in our export**. The Court decides far more than 700 matters a year; this collection holds the *reported* ones, and how many were reported or digitised varies by year (1996 is unusually full; 1982 and 2020 are thin). 2025 ends on 2025-11-06. I could not find a cause for 1982 or 2020 inside the files; to settle it the AWS Open Data release would have to be compared year by year (a download, see item 11 of W10). Until then the court page should not be read as a complete list of a year's judgments.

## Duplicates
Case ids with identical decision date and title: 22 groups (23 extra records). Almost all are **different judgments** in connected matters (for example 1958_INSC_25 and 1958_INSC_26 are two reports of *Shantabai v. State of Bombay* on different report pages). Checked by comparing the full English text with the printed citation and digits removed: **5 pairs have identical text** and are the same judgment listed twice:

| Later record | Same text as |
|---|---|
| 1979_INSC_254 | 1979_INSC_253 (K. Kalpana Saraswathi v. P.S.S. Somasundaram Chettiar) |
| 1997_INSC_348 | 1997_INSC_347 (Pratap Pharma v. Union of India) |
| 2007_INSC_258 | 2007_INSC_257 (Commissioner of Sales Tax, Orissa v. Crown Re-Roller) |
| 2008_INSC_221 | 2008_INSC_216 (N. Srihari v. N. Prakash) |
| 2013_INSC_123 | 2013_INSC_121 (Bagai Construction v. Gupta Building Material) |

What was done: both records stay in the list (we never delete a record the source holds), and the later one now shows a notice on its page linking to the first (`src/config/sc-duplicates.json`). That makes the count of *different* judgments 37,009. Duplicates among cases that have no English text could not be checked.

## Other findings
- The dataset's `case_number` and `bench` fields are empty for all 37,014 cases; our case numbers (32.0%) and full benches (65.5%) are extracted from the opening text (W-earlier work).
- 1,418 cases have no English document, so they have no opening text, no preview and no statute links; their Hindi or regional text is in the file.
