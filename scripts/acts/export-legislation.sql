-- Phase 1 export: ACT-LEVEL legislation metadata only, from the open-india-law snapshot (CC BY 4.0).
-- Reads: in_*_legislation.parquet (central + state/UT). Does NOT read regulators, judgments or vectors.
-- Never selects `text`, never orders or concatenates chunks. sectionCount = distinct non-blank section_number per act,
-- which does not depend on how split rows are ordered. Placeholders __DIR__ and __OUT__ are filled in by export-legislation.sh.

CREATE TEMP TABLE acts AS
WITH per_act AS (
  SELECT
    act_id,
    -- the source escapes a handful of characters as HTML entities (7 acts: &quot; and &#x2F;); decoded here, nothing else is edited
    any_value(replace(replace(replace(replace(trim(title), '&quot;', '"'), '&#x2F;', '/'), '&amp;', '&'), '&#39;', chr(39))) AS title,
    any_value(CAST(year AS INTEGER))               AS year_raw,
    any_value(jurisdiction)                        AS jurisdiction,
    any_value(nullif(trim(state), ''))             AS state,
    any_value(act_status)                          AS act_status,
    count(DISTINCT nullif(trim(section_number), '')) AS section_count
  FROM read_parquet('__DIR__/in_*_legislation.parquet')
  GROUP BY act_id
), derived AS (
  SELECT *,
    try_cast(nullif(regexp_extract(title, '(1[6-9][0-9]{2}|20[0-9]{2})', 1), '') AS INTEGER) AS year_from_title,
    regexp_extract(title, '(?:^|[ ,(])([0-9]+) of ([0-9]{4})', 1) AS num_raw,
    regexp_extract(title, '(?:^|[ ,(])([0-9]+) of ([0-9]{4})', 2) AS num_year
  FROM per_act
)
SELECT
  act_id AS "actId",
  title,
  coalesce(year_raw, year_from_title) AS year,
  CASE jurisdiction WHEN 'central' THEN 'central' WHEN 'state' THEN 'state' END AS category,
  state,
  -- "N of YYYY" is taken from the title only when YYYY matches the act's own year; otherwise left blank.
  CASE WHEN num_raw <> '' AND try_cast(num_year AS INTEGER) = coalesce(year_raw, year_from_title) THEN num_raw || ' of ' || num_year END AS "actNumber",
  act_status AS "actStatus",
  title AS citation,            -- constructed: the dataset has no citation field for acts
  CAST(section_count AS INTEGER) AS "sectionCount",
  (year_raw IS NULL AND year_from_title IS NOT NULL) AS year_derived
FROM derived;

-- Fail loudly if an unexpected jurisdiction or status appears.
SELECT CASE WHEN count(*) = 0 THEN 'ok' ELSE error('unexpected category/status: ' || count(*)) END AS check_values
FROM acts WHERE category IS NULL OR "actStatus" NOT IN ('in_force','repealed','superseded','spent');

COPY (SELECT "actId", title, year, category, state, "actNumber", "actStatus", citation, "sectionCount" FROM acts ORDER BY "actId")
  TO '__OUT__/acts.legislation.json' (FORMAT JSON, ARRAY true);

COPY (SELECT
  count(*) AS acts,
  sum("sectionCount") AS sections,
  count(*) FILTER (category = 'central') AS central,
  count(*) FILTER (category = 'state') AS state,
  count(*) FILTER ("actStatus" = 'in_force') AS in_force,
  count(*) FILTER ("actStatus" = 'repealed') AS repealed,
  count(*) FILTER ("actStatus" = 'spent') AS spent,
  count(*) FILTER (year IS NULL) AS year_missing,
  count(*) FILTER (year_derived) AS year_derived_from_title,
  count(*) FILTER ("actNumber" IS NOT NULL) AS act_number_derived,
  count(*) FILTER ("sectionCount" = 0) AS zero_section_count,
  'open-india-law v2026.08 (in_*_legislation.parquet)' AS source,
  'CC BY 4.0' AS licence,
  strftime(now(), '%Y-%m-%dT%H:%M:%SZ') AS generated_at
 FROM acts) TO '__OUT__/acts.legislation.meta.json' (FORMAT JSON, ARRAY false);
