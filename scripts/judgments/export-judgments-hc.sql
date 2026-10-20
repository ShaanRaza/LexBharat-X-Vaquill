-- One High Court, metadata only. Placeholders filled by export-judgments-hc.sh: __FILE__ __OUT__ __TMP__ __SLUG__ __YF__ __YT__ __JUDGES__ (true/false).
-- Never reads `text`. See docs/JUDGMENTS-HC.md for every rule below.
CREATE TEMP TABLE g AS
SELECT case_id AS "caseId", any_value(nullif(trim(title),'')) AS title_raw, any_value(nullif(trim(case_number),'')) AS "caseNumber",
  any_value(nullif(trim(decision_date),'')) AS dd, any_value(nullif(trim(CAST(year AS VARCHAR)),'')) AS yr,
  any_value(nullif(trim(disposition),'')) AS disposition, -- Some courts (Kerala, Karnataka...) write the case reference in front of the party: "WP(C)/19571/2019 of K.G.RAJU". Strip that prefix and trailing commas; nothing else is edited.
  any_value(nullif(trim(regexp_replace(rtrim(trim(petitioner), ','), '^[^/]{1,30}/[0-9]+/[0-9]{4} of ', '')), '')) AS petitioner, any_value(nullif(trim(regexp_replace(rtrim(trim(respondent), ','), '^[^/]{1,30}/[0-9]+/[0-9]{4} of ', '')), '')) AS respondent,
  any_value(nullif(trim(citation),'')) AS citation, any_value(nullif(trim(date_of_registration),'')) AS "dateOfRegistration",
  any_value(judges) AS judges_raw, max(page_end) AS pages_raw
FROM read_parquet('__FILE__') GROUP BY case_id;

CREATE TEMP TABLE c AS
SELECT *,
  -- The source writes a missing number as the word None ("WRIT PETITION None", "None None"): strip it; an empty result stays NULL.
  nullif(trim(regexp_replace(regexp_replace(title_raw, '\s*\bNone\s*$', ''), '^None\s+', '')), '') AS title,
  try_cast(left(dd,10) AS DATE) AS dt,
  -- Party names are shown only when BOTH look like party names. Extraction junk ("picture [72 x 72] intentionally omitted", a leading '+', '>' or '$', an embedded case number such as 354/2024, a file name such as "FA 527 20.odt", or over 150 characters) drops both, never one.
  (petitioner IS NOT NULL AND respondent IS NOT NULL
    AND NOT regexp_matches(petitioner || ' ' || respondent, 'picture \[|intentionally omitted|[0-9]+/[0-9]{4}|\.(odt|docx?|pdf)\b')
    AND NOT regexp_matches(petitioner, '^[^A-Za-z0-9(]') AND NOT regexp_matches(respondent, '^[^A-Za-z0-9(]')
    AND length(petitioner) <= 150 AND length(respondent) <= 150) AS party_ok,
  -- Judges are exported only for courts whose judge field was verified (flag), and only for a case when EVERY entry looks like a person's name
  -- (capital letters, dots, apostrophes, hyphens; no CORAM/ORAL glue). A case with any other entry gets no judges and no bench size, never a partial list.
  CASE WHEN __JUDGES__ AND judges_raw IS NOT NULL AND len(judges_raw) > 0
        AND list_bool_and(list_transform(judges_raw, lambda x: regexp_matches(x, '^[A-Z][A-Z .''-]{3,44}$') AND NOT regexp_matches(x, 'CORAM|ORAL$')))
       THEN judges_raw END AS judges,
  -- Disposition shown as a chip only for the common, unambiguous values (about 92% of cases); the other ~490 spellings stay as recorded text on the detail page.
  CASE upper(trim(disposition))
    WHEN 'DISMISSED' THEN 'Dismissed' WHEN 'ALLOWED' THEN 'Allowed' WHEN 'DISPOSED' THEN 'Disposed of' WHEN 'DISPOSED OF' THEN 'Disposed of' WHEN 'DISPOSED OFF' THEN 'Disposed of'
    WHEN 'REJECTED' THEN 'Rejected' WHEN 'BAIL GRANTED' THEN 'Bail granted' WHEN 'BAIL REJECTED' THEN 'Bail rejected' WHEN 'CLOSED' THEN 'Closed' WHEN 'WITHDRAWN' THEN 'Withdrawn'
    WHEN 'PARTLY ALLOWED' THEN 'Partly allowed' WHEN 'QUASHED' THEN 'Quashed' WHEN 'REMANDED' THEN 'Remanded' WHEN 'ACQUITTED' THEN 'Acquitted' WHEN 'CONVICTED' THEN 'Convicted'
    WHEN 'GRANTED' THEN 'Granted' WHEN 'DISMISSED AS INFRUCTUOUS' THEN 'Dismissed as infructuous' WHEN 'DISMISSED AS WITHDRAWN' THEN 'Dismissed as withdrawn' WHEN 'DISMISSED ON MERITS' THEN 'Dismissed on merits'
  END AS "dispositionLabel"
FROM g;

CREATE TEMP TABLE r AS
SELECT *, CASE WHEN dt BETWEEN DATE '1900-01-01' AND DATE '2026-08-31' THEN CAST(year(dt) AS INTEGER)
               WHEN dd IS NULL AND try_cast(yr AS INTEGER) BETWEEN 1900 AND 2026 THEN try_cast(yr AS INTEGER) END AS year_final FROM c;

COPY (SELECT "caseId",
        CASE WHEN dd IS NOT NULL AND dt IS NULL THEN 'decision_date does not parse' WHEN dt IS NOT NULL THEN 'decision_date outside 1900-01-01..2026-08-31' ELSE 'no usable year' END AS reason,
        dd AS decision_date_raw, yr AS year_raw
      FROM r WHERE year_final IS NULL ORDER BY 1) TO '__OUT__/_quarantine/__SLUG__.json' (FORMAT JSON, ARRAY true);

-- Newest first: decisionDate descending (undated last), then caseId. Pages of 100 are numbered in that order.
CREATE TEMP TABLE p AS
SELECT "caseId", title, "caseNumber", strftime(dt, '%Y-%m-%d') AS "decisionDate", disposition, "dispositionLabel", CASE WHEN party_ok THEN petitioner END AS petitioner, CASE WHEN party_ok THEN respondent END AS respondent, citation, "dateOfRegistration",
  judges, CAST(len(judges) AS INTEGER) AS "benchSize",
  -- Page count = the last page the extracted text reaches (max page_end over the case's chunks); 100% of cases have it and it never decreases along the text in 99% of cases checked.
  -- Values above 2000 are treated as extraction noise and dropped.
  CASE WHEN pages_raw BETWEEN 1 AND 2000 THEN CAST(pages_raw AS INTEGER) END AS pages,
  year_final AS year,
  CAST(floor((row_number() OVER (PARTITION BY year_final ORDER BY dt DESC NULLS LAST, "caseId") - 1) / 100) AS INTEGER) + 1 AS page
FROM r WHERE year_final BETWEEN __YF__ AND __YT__;

COPY (SELECT year, count(*) AS cases, max(page) AS pages FROM p GROUP BY year ORDER BY year DESC) TO '__OUT__/_manifest/__SLUG__.json' (FORMAT JSON, ARRAY true);
COPY (SELECT count(*) AS cases, round(100.0*avg((title IS NOT NULL)::int),1) AS title, round(100.0*avg(("caseNumber" IS NOT NULL)::int),1) AS case_number,
  round(100.0*avg(("decisionDate" IS NOT NULL)::int),1) AS decision_date, round(100.0*avg((disposition IS NOT NULL)::int),1) AS disposition,
  round(100.0*avg(("dispositionLabel" IS NOT NULL)::int),1) AS disposition_chip, round(100.0*avg((petitioner IS NOT NULL AND respondent IS NOT NULL)::int),1) AS parties,
  round(100.0*avg((judges IS NOT NULL)::int),1) AS judges, round(100.0*avg((pages IS NOT NULL)::int),1) AS pages,
  round(100.0*avg((citation IS NOT NULL)::int),1) AS citation FROM p) TO '__OUT__/_fields/__SLUG__.json' (FORMAT JSON, ARRAY false);
COPY (SELECT "caseId", title, "caseNumber", "decisionDate", disposition, "dispositionLabel", petitioner, respondent, citation, "dateOfRegistration", judges, "benchSize", pages, year, page FROM p
      ORDER BY year, page, "decisionDate" DESC NULLS LAST, "caseId") TO '__TMP__/__SLUG__.ndjson' (FORMAT JSON, ARRAY false);
