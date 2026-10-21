-- Supreme Court opening-text preview, one per case, from the ENGLISH document only. Placeholders: __FILE__ __OUT__ __TMP__.
-- Why this needs rules: one SC case_id holds several parallel documents (English plus Hindi, Punjabi, Gujarati... translations; language_code tells them apart) and
-- chunk_index repeats across them (only 602 of 37,014 cases have a clean 0..n-1 sequence), so neither chunk_index nor "first row" is a safe order.
-- A safe "document start" exists: the single chunk with language_code = 'en' AND char_start = 0 (exactly one in 35,592 of 37,014 cases; none in 1,422, which get no preview).
-- No chunks are ordered, joined or concatenated: the preview is the first ~900 characters of that one chunk, minus its "Case: .. / Section: .." header lines.
CREATE TEMP TABLE start AS
SELECT case_id, any_value(text) AS text, any_value(section_type) AS section_type
FROM read_parquet('__FILE__') WHERE language_code = 'en' AND char_start = 0 GROUP BY case_id HAVING count(*) = 1;
CREATE TEMP TABLE yr AS
SELECT case_id, coalesce(try_cast(left(any_value(trim(decision_date)),4) AS INTEGER), any_value(CAST(year AS INTEGER))) AS year
FROM read_parquet('__FILE__') GROUP BY case_id;
CREATE TEMP TABLE cleaned AS
SELECT s.case_id, y.year,
  left(trim(regexp_replace(regexp_replace(regexp_replace(s.text, '^Case:[^\n]*\n+Section:[^\n]*\n*', ''), '\[(SECTION|TITLE)\]\s*(#+)?\s*', ' ', 'g'), '\s+', ' ', 'g')), 900) AS flat
FROM start s JOIN yr y USING (case_id);
-- Quality gate: at least 200 characters and at least 85% of the words look like words (letters with ordinary punctuation); OCR noise such as "EEISSS'SSYSDSSSTT>re" fails.
CREATE TEMP TABLE scored AS
SELECT *, string_split(flat, ' ') AS toks FROM cleaned WHERE length(flat) >= 200;
CREATE TEMP TABLE good AS
SELECT case_id, year, regexp_replace(flat, '\s+\S*$', '') AS text FROM scored
WHERE year BETWEEN 1900 AND 2026
  AND len(list_filter(toks, lambda t: regexp_matches(t, '^[\(\["'']*[A-Za-z][A-Za-z''-]{0,19}[\)\]",.;:]*$') OR regexp_matches(t, '^[0-9][0-9.,()/-]*[,.;:]?$'))) >= 0.85 * len(toks);
COPY (SELECT year, case_id AS "caseId", text FROM good ORDER BY year, case_id) TO '__TMP__/sc-preview.ndjson' (FORMAT JSON, ARRAY false);
COPY (SELECT (SELECT count(*) FROM yr) AS cases, (SELECT count(*) FROM start) AS with_single_english_start, (SELECT count(*) FROM scored) AS long_enough, (SELECT count(*) FROM good) AS previews) TO '__OUT__/_fields/sc-preview.json' (FORMAT JSON, ARRAY false);
