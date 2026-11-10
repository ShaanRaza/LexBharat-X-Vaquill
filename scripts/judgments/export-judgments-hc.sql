-- One High Court, metadata only. Placeholders filled by export-judgments-hc.sh: __FILE__ __OUT__ __TMP__ __SLUG__ __YF__ __YT__ __PREFIXES__ (the court's CNR prefixes, quoted).
-- Never reads `text`. No person data leaves this file: petitioner, respondent and judges are read only to COUNT what was removed (_removed/<slug>.json). See docs/JUDGMENTS-HC.md.
SET memory_limit='3GB'; SET threads=2; SET preserve_insertion_order=false; SET temp_directory='/tmp/duck-export-hc';
CREATE TEMP TABLE g AS
SELECT case_id AS "caseId", any_value(nullif(trim(title),'')) AS title_raw, any_value(nullif(trim(case_number),'')) AS "caseNumberRecorded",
  any_value(nullif(trim(decision_date),'')) AS dd, any_value(nullif(trim(CAST(year AS VARCHAR)),'')) AS yr,
  any_value(nullif(trim(disposition),'')) AS disposition,
  any_value(nullif(trim(citation),'')) AS citation, any_value(nullif(trim(date_of_registration),'')) AS "dateOfRegistration", max(page_end) AS pages_raw,
  bool_or(nullif(trim(petitioner),'') IS NOT NULL OR nullif(trim(respondent),'') IS NOT NULL) AS had_parties, bool_or(len(judges) > 0) AS had_judges
FROM read_parquet('__FILE__') GROUP BY case_id;

-- Title rules: `title` (registration form) and `caseNumber` are the same as regFormOf() / caseNumberOf() in src/lib/judgments/hcRecord.mjs (hcRecord.test.mjs
-- runs both on the same titles). The party title (displayTitle) cannot be cleaned here: its rules need look-ahead and look-behind, which DuckDB's regex
-- engine lacks. So t0 goes out as titleRaw in the TEMP files only, and scripts/judgments/hc-display-titles.mjs turns it into displayTitle (or null) and
-- removes titleRaw before any page is written. The guard fails if titleRaw ever reaches the output.
-- t0: the source writes a missing number as the word None ("WRIT PETITION None", "None None"): strip it, collapse spaces; an empty result stays NULL.
CREATE TEMP TABLE c0 AS
SELECT *, nullif(nullif(trim(regexp_replace(regexp_replace(regexp_replace(title_raw, '\s*\bNone\s*$', ''), '^None\s+', ''), '\s+', ' ', 'g')), ''), 'None') AS t0 FROM g;
CREATE TEMP TABLE c AS
SELECT *,
  -- R1 "WP(C)/19571/2019 of K.G.RAJU Vs ..." -> "WP(C)/19571/2019": the party tail after the year is cut. R2 "WRIT PETITION 609 of 1999" is kept whole. Any other title may hold names: dropped.
  coalesce(regexp_matches(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)'), false) AS r1,
  coalesce(NOT regexp_matches(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)') AND regexp_matches(t0, '^([A-Za-z][A-Za-z0-9 .()&,-]{0,60}?)\s+(?:No\.?\s*)?(\d{1,7})\s*(?:/|\s(?:of|OF|Of)\s)\s*(\d{4})$'), false) AS r2,
  try_cast(left(dd,10) AS DATE) AS dt,
  -- The court is the FILE's court; a row whose id prefix names another court is quarantined, never listed under the wrong court.
  NOT coalesce(list_contains([__PREFIXES__], regexp_extract("caseId", '^[A-Z]+')), false) AS wrong_court,
  -- Disposition shown as a chip only for the common, unambiguous values (about 92% of cases); the other ~490 spellings stay as recorded text on the detail page.
  CASE upper(trim(disposition))
    WHEN 'DISMISSED' THEN 'Dismissed' WHEN 'ALLOWED' THEN 'Allowed' WHEN 'DISPOSED' THEN 'Disposed of' WHEN 'DISPOSED OF' THEN 'Disposed of' WHEN 'DISPOSED OFF' THEN 'Disposed of'
    WHEN 'REJECTED' THEN 'Rejected' WHEN 'BAIL GRANTED' THEN 'Bail granted' WHEN 'BAIL REJECTED' THEN 'Bail rejected' WHEN 'CLOSED' THEN 'Closed' WHEN 'WITHDRAWN' THEN 'Withdrawn'
    WHEN 'PARTLY ALLOWED' THEN 'Partly allowed' WHEN 'QUASHED' THEN 'Quashed' WHEN 'REMANDED' THEN 'Remanded' WHEN 'ACQUITTED' THEN 'Acquitted' WHEN 'CONVICTED' THEN 'Convicted'
    WHEN 'GRANTED' THEN 'Granted' WHEN 'DISMISSED AS INFRUCTUOUS' THEN 'Dismissed as infructuous' WHEN 'DISMISSED AS WITHDRAWN' THEN 'Dismissed as withdrawn' WHEN 'DISMISSED ON MERITS' THEN 'Dismissed on merits'
  END AS "dispositionLabel"
FROM c0;

CREATE TEMP TABLE r AS
SELECT *,
  CASE WHEN r1 THEN coalesce(nullif(trim(regexp_extract(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)', 1)), '') || '/', '')
                    || regexp_extract(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)', 2) || '/' || regexp_extract(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)', 3)
       WHEN r2 THEN t0 END AS title,
  CASE WHEN r1 THEN CAST(CAST(regexp_extract(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)', 2) AS BIGINT) AS VARCHAR) || '/' || regexp_extract(t0, '^\s*([^/]{0,40}?)\s*/\s*(\d{1,7})\s*/\s*(\d{4})(?:\s|$)', 3)
       WHEN r2 THEN CAST(CAST(regexp_extract(t0, '^([A-Za-z][A-Za-z0-9 .()&,-]{0,60}?)\s+(?:No\.?\s*)?(\d{1,7})\s*(?:/|\s(?:of|OF|Of)\s)\s*(\d{4})$', 2) AS BIGINT) AS VARCHAR) || '/' || regexp_extract(t0, '^([A-Za-z][A-Za-z0-9 .()&,-]{0,60}?)\s+(?:No\.?\s*)?(\d{1,7})\s*(?:/|\s(?:of|OF|Of)\s)\s*(\d{4})$', 3)
  END AS "caseNumber",
  CASE WHEN dt BETWEEN DATE '1900-01-01' AND DATE '2026-08-31' THEN CAST(year(dt) AS INTEGER)
       WHEN dd IS NULL AND try_cast(yr AS INTEGER) BETWEEN 1900 AND 2026 THEN try_cast(yr AS INTEGER) END AS year_final
FROM c;

COPY (SELECT "caseId",
        CASE WHEN wrong_court THEN 'record id names another court' WHEN dd IS NOT NULL AND dt IS NULL THEN 'decision_date does not parse' WHEN dt IS NOT NULL THEN 'decision_date outside 1900-01-01..2026-08-31' ELSE 'no usable year' END AS reason,
        dd AS decision_date_raw, yr AS year_raw
      FROM r WHERE year_final IS NULL OR wrong_court ORDER BY 1) TO '__OUT__/_quarantine/__SLUG__.json' (FORMAT JSON, ARRAY true);

-- Newest first: decisionDate descending (undated last), then caseId. Pages of 100 are numbered in that order.
CREATE TEMP TABLE p AS
SELECT "caseId", title, "caseNumber", "caseNumberRecorded", strftime(dt, '%Y-%m-%d') AS "decisionDate", disposition, "dispositionLabel", citation, "dateOfRegistration",
  -- Page count = the last page the extracted text reaches (max page_end over the case's chunks). Values above 2000 are treated as extraction noise and dropped.
  CASE WHEN pages_raw BETWEEN 1 AND 2000 THEN CAST(pages_raw AS INTEGER) END AS pages,
  year_final AS year,
  CAST(floor((row_number() OVER (PARTITION BY year_final ORDER BY dt DESC NULLS LAST, "caseId") - 1) / 100) AS INTEGER) + 1 AS page,
  had_parties, had_judges, t0, r1
FROM r WHERE NOT wrong_court AND year_final BETWEEN __YF__ AND __YT__;

COPY (SELECT year, count(*) AS cases, max(page) AS pages FROM p GROUP BY year ORDER BY year DESC) TO '__OUT__/_manifest/__SLUG__.json' (FORMAT JSON, ARRAY true);

-- ---- In-year filter, shaped at export time (no index needed): the disposition chip. Each filtered list is its own set of 100-case pages (newest first) under
-- year=Y/disp=<slug>/, and every row carries mainPage, the page of the unfiltered list that holds the same case, so the case detail link still works. year=Y/facets.json holds the counts.
CREATE TEMP TABLE f AS SELECT *, lower(replace("dispositionLabel", ' ', '-')) AS disp_slug FROM p;
CREATE TEMP TABLE fp AS
SELECT year, 'disp' AS kind, disp_slug AS key,
  CAST(floor((row_number() OVER (PARTITION BY year, disp_slug ORDER BY "decisionDate" DESC NULLS LAST, "caseId") - 1) / 100) AS INTEGER) + 1 AS fpage,
  page AS "mainPage", "caseId", title, t0 AS "titleRaw", "caseNumber", "caseNumberRecorded", "decisionDate", disposition, "dispositionLabel", citation, "dateOfRegistration", pages
FROM f WHERE disp_slug IS NOT NULL;
COPY (SELECT year, kind, key, fpage AS page, "mainPage", "caseId", title, "titleRaw", "caseNumber", "caseNumberRecorded", "decisionDate", disposition, "dispositionLabel", citation, "dateOfRegistration", pages
      FROM fp ORDER BY year, kind, key, fpage, "decisionDate" DESC NULLS LAST, "caseId") TO '__TMP__/__SLUG__.filtered.ndjson' (FORMAT JSON, ARRAY false);
COPY (
  SELECT y.year,
    (SELECT list({'value': "dispositionLabel", 'slug': disp_slug, 'count': c} ORDER BY c DESC, "dispositionLabel") FROM (SELECT "dispositionLabel", disp_slug, count(*) AS c FROM f WHERE f.year = y.year AND disp_slug IS NOT NULL GROUP BY 1, 2)) AS disposition
  FROM (SELECT DISTINCT year FROM p) y ORDER BY y.year
) TO '__TMP__/__SLUG__.facets.ndjson' (FORMAT JSON, ARRAY false);
COPY (SELECT count(*) AS cases, round(100.0*avg((title IS NOT NULL)::int),1) AS title, round(100.0*avg(("caseNumber" IS NOT NULL)::int),1) AS case_number,
  round(100.0*avg(("caseNumberRecorded" IS NOT NULL)::int),1) AS case_number_recorded,
  round(100.0*avg(("decisionDate" IS NOT NULL)::int),1) AS decision_date, round(100.0*avg((disposition IS NOT NULL)::int),1) AS disposition,
  round(100.0*avg(("dispositionLabel" IS NOT NULL)::int),1) AS disposition_chip, round(100.0*avg((pages IS NOT NULL)::int),1) AS pages,
  round(100.0*avg((citation IS NOT NULL)::int),1) AS citation FROM p) TO '__OUT__/_fields/__SLUG__.json' (FORMAT JSON, ARRAY false);
-- What was removed, counted over the listed cases (counts only, no values).
COPY (SELECT count(*) AS cases,
  count(*) FILTER (had_parties) AS parties_removed, count(*) FILTER (had_judges) AS judges_removed,
  count(*) FILTER (r1 AND t0 <> title) AS title_tail_cut, count(*) FILTER (t0 IS NOT NULL AND title IS NULL) AS title_dropped,
  count(*) FILTER ("caseNumber" IS NOT NULL AND "caseNumberRecorded" IS NOT NULL
    AND "caseNumber" <> coalesce(CAST(try_cast(regexp_extract("caseNumberRecorded", '^0*(\d{1,7})\s*(?:/|\s(?:of|OF|Of)\s)\s*(\d{4})', 1) AS BIGINT) AS VARCHAR) || '/' || regexp_extract("caseNumberRecorded", '^0*(\d{1,7})\s*(?:/|\s(?:of|OF|Of)\s)\s*(\d{4})', 2), '')) AS case_number_differs,
  (SELECT count(*) FROM r WHERE wrong_court) AS wrong_court_quarantined
  FROM p) TO '__OUT__/_removed/__SLUG__.json' (FORMAT JSON, ARRAY false);
COPY (SELECT "caseId", title, t0 AS "titleRaw", "caseNumber", "caseNumberRecorded", "decisionDate", disposition, "dispositionLabel", citation, "dateOfRegistration", pages, year, page FROM p
      ORDER BY year, page, "decisionDate" DESC NULLS LAST, "caseId") TO '__TMP__/__SLUG__.ndjson' (FORMAT JSON, ARRAY false);
