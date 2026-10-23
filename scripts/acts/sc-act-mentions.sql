-- Counts, per Act name as written in Supreme Court judgments, how many judgments (distinct case_id) name it. Used by rank-central-acts.mjs.
-- Replace __DIR__ and __OUT__ (see docs/MISSING-SECTIONS.md). Takes about a minute on the full snapshot.
COPY (
  WITH m AS (
    SELECT case_id, unnest(list_concat(
      regexp_extract_all(text, '((?:[A-Z][A-Za-z&()\x27\-]*\s+){1,7}(?:Act|Code|Sanhita|Adhiniyam)),?\s+(?:No\.\s*[0-9]+\s+of\s+)?(?:of\s+)?([12][0-9]{3})', 0),
      regexp_extract_all(text, '((?:Code of (?:Civil|Criminal) Procedure|(?:Civil|Criminal) Procedure Code)),?\s+(?:of\s+)?([12][0-9]{3})', 0))) AS mention
    FROM read_parquet('__DIR__/in_supreme-court_judgments.parquet'))
  SELECT lower(regexp_replace(regexp_replace(mention, '[,.]', ' ', 'g'), '\s+', ' ', 'g')) AS k, count(DISTINCT case_id) AS cases
  FROM m GROUP BY 1 HAVING count(DISTINCT case_id) >= 5 ORDER BY 2 DESC
) TO '__OUT__' (HEADER, DELIMITER ',');
