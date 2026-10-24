-- Phase 3 export: ACT-LEVEL regulator instruments (RBI, SEBI, MCA, ...) from the open-india-law snapshot (CC BY 4.0), as category "regulatory".
-- Reads in_*_regulations.parquet only. Never selects `text`, never orders or concatenates chunks. Same mapping rules as export-legislation.sql.
-- Placeholders __DIR__ and __OUT__ are filled in by export-regulations.sh.
CREATE TEMP TABLE regs AS
WITH per_act AS (
  SELECT act_id,
    any_value(replace(replace(replace(replace(trim(title), '&quot;', '"'), '&#x2F;', '/'), '&amp;', '&'), '&#39;', chr(39))) AS title,
    any_value(CAST(year AS INTEGER)) AS year_raw,
    any_value(nullif(trim(department), '')) AS department,
    any_value(act_status) AS act_status,
    count(DISTINCT department) AS n_dept, count(DISTINCT act_status) AS n_status, count(DISTINCT title) AS n_title,
    count(DISTINCT nullif(trim(section_number), '')) AS section_count
  FROM read_parquet('__DIR__/in_*_regulations.parquet')
  -- W10: the Law Commission reports (558) and the tribunal-filed instruments (354: IBBI, GST AAR, CAT, TDSAT, APTEL) are listed too, as title-only entries with the title made readable (below); the original title stays in `citation`.
  GROUP BY act_id
), derived AS (
  SELECT *, try_cast(nullif(regexp_extract(title, '(1[6-9][0-9]{2}|20[0-9]{2})', 1), '') AS INTEGER) AS year_from_title FROM per_act
)
-- Year is NOT derived from the title for regulators: titles cite other years ("Government Stock, 2082", "Act IX of 1872"), which made 87 entries wrong.
SELECT act_id AS "actId",
  CASE
    WHEN department = 'law-commission' AND regexp_matches(title, '^[0-9]{3} ') THEN 'Law Commission of India, Report No. ' || CAST(CAST(substr(title, 1, 3) AS INTEGER) AS VARCHAR) || ' — ' || trim(substr(title, 5))
    WHEN department = 'law-commission' THEN 'Law Commission of India — ' || title
    WHEN regexp_matches(title, '^[0-9A-Fa-f]{32}$') THEN 'Document ' || lower(substr(title, 1, 8)) || ' (title not given in the source)'
    ELSE title END AS title, year_raw AS year, 'regulatory' AS category, department,
  act_status AS "actStatus", title AS citation, CAST(section_count AS INTEGER) AS "sectionCount",
  false AS year_derived, n_dept, n_status, n_title
FROM derived;

SELECT CASE WHEN count(*) = 0 THEN 'ok' ELSE error('unstable per-act attributes or unexpected status: ' || count(*)) END AS check_values
FROM regs WHERE n_dept > 1 OR n_status > 1 OR n_title > 1 OR "actStatus" NOT IN ('in_force','repealed','superseded','spent');

COPY (SELECT "actId", title, year, category, department, "actStatus", citation, "sectionCount" FROM regs ORDER BY "actId")
  TO '__OUT__/acts.regulations.json' (FORMAT JSON, ARRAY true);

COPY (SELECT count(*) AS acts, sum("sectionCount") AS sections,
  count(*) FILTER ("actStatus" = 'in_force') AS in_force, count(*) FILTER ("actStatus" = 'superseded') AS superseded,
  count(*) FILTER (year IS NULL) AS year_missing, count(*) FILTER (year_derived) AS year_derived_from_title,
  count(*) FILTER ("sectionCount" = 0) AS zero_section_count, count(DISTINCT department) AS departments,
  'open-india-law v2026.08 (in_*_regulations.parquet)' AS source, 'CC BY 4.0' AS licence, strftime(now(), '%Y-%m-%dT%H:%M:%SZ') AS generated_at
 FROM regs) TO '__OUT__/acts.regulations.meta.json' (FORMAT JSON, ARRAY false);

COPY (SELECT department, count(*) AS acts FROM regs GROUP BY 1 ORDER BY 2 DESC) TO '__OUT__/acts.regulations.departments.json' (FORMAT JSON, ARRAY true);
