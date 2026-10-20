#!/usr/bin/env bash
# High Court case-level export (metadata only, no judgment text) from the open-india-law snapshot (CC BY 4.0).
# Layout (hive-style, one JSON array per file, 100 cases per page, newest year first is a UI matter):
#   <OUT>/court=<slug>/year=<YYYY>/page=<N>/data_0.json      (written by split_pages.py) N starts at 1; cases sorted by decisionDate (nulls last), then caseId
#   <OUT>/_manifest/<slug>.json                              [{year, cases, pages}]
#   <OUT>/_quarantine/<slug>.json                            cases left out, with the reason (never mixed into browse output)
#   <OUT>/_fields/<slug>.json                                fill rates per field, for docs/JUDGMENTS-HC.md
# NOT exported for High Courts: judges and bench strength (the source field holds sentence fragments such as "therefore", "inter alia", "pass" for Delhi and Kerala).
# Rules (see docs/JUDGMENTS-HC.md): the court comes from the FILE (25 canonical slugs), never from the free-text `court` column (50 spellings).
# Year = year of decision_date when it parses and lies in 1900-01-01..2026-08-31 (the snapshot end); if decision_date is blank, the record's `year`
# column when it is 1900..2026 (decisionDate stays null); anything else is quarantined. Never reads `text`; never orders or joins chunks.
# Usage: [HC_COURTS=delhi-high-court,bombay-high-court] [HC_YEARS=2024-2025] scripts/judgments/export-judgments-hc.sh [DATASET_DIR] [OUT_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; OUT="${2:-data/judgments-hc}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR (is the SSD plugged in?)" >&2; exit 1; }
slug() { case "$1" in jammu-and-kashmir) echo high-court-of-jammu-and-kashmir-and-ladakh;; punjab-and-haryana) echo punjab-and-haryana-high-court;; *) echo "$1-high-court";; esac; }
YF=1900; YT=2026; if [ -n "${HC_YEARS:-}" ]; then YF="${HC_YEARS%-*}"; YT="${HC_YEARS#*-}"; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT/_manifest" "$OUT/_quarantine" "$OUT/_fields"
for f in "$DIR"/in_*_judgments.parquet; do
  stem="$(basename "$f" _judgments.parquet)"; stem="${stem#in_}"; [ "$stem" = "supreme-court" ] && continue
  s="$(slug "$stem")"
  if [ -n "${HC_COURTS:-}" ] && [[ ",$HC_COURTS," != *",$s,"* ]]; then continue; fi
  echo "exporting $s" >&2; rm -rf "$OUT/court=$s"
  duckdb -c "
CREATE TEMP TABLE g AS
SELECT case_id AS \"caseId\", any_value(nullif(trim(title),'')) AS title_raw, any_value(nullif(trim(case_number),'')) AS \"caseNumber\",
  any_value(nullif(trim(decision_date),'')) AS dd, any_value(nullif(trim(CAST(year AS VARCHAR)),'')) AS yr,
  any_value(nullif(trim(disposition),'')) AS disposition, any_value(nullif(trim(petitioner),'')) AS petitioner, any_value(nullif(trim(respondent),'')) AS respondent,
  any_value(nullif(trim(citation),'')) AS citation,
  any_value(nullif(trim(date_of_registration),'')) AS \"dateOfRegistration\"
FROM read_parquet('$f') GROUP BY case_id;
CREATE TEMP TABLE c AS
-- Title artifact: the source writes the missing number as the word None (\"WRIT PETITION None\", \"None None\"). Strip it; a title that becomes empty stays NULL.
SELECT *, nullif(trim(regexp_replace(title_raw, '\\s*\\bNone\\s*$', '')), '') AS title, try_cast(left(dd,10) AS DATE) AS dt FROM g;
CREATE TEMP TABLE r AS
SELECT *, CASE WHEN dt BETWEEN DATE '1900-01-01' AND DATE '2026-08-31' THEN CAST(year(dt) AS INTEGER)
               WHEN dd IS NULL AND try_cast(yr AS INTEGER) BETWEEN 1900 AND 2026 THEN try_cast(yr AS INTEGER) END AS year_final FROM c;
COPY (SELECT \"caseId\", CASE WHEN dd IS NOT NULL AND dt IS NULL THEN 'decision_date does not parse' WHEN dt IS NOT NULL THEN 'decision_date outside 1900-01-01..2026-08-31' ELSE 'no usable year' END AS reason, dd AS decision_date_raw, yr AS year_raw
      FROM r WHERE year_final IS NULL ORDER BY 1) TO '$OUT/_quarantine/$s.json' (FORMAT JSON, ARRAY true);
CREATE TEMP TABLE p AS
SELECT \"caseId\", title, \"caseNumber\", strftime(dt, '%Y-%m-%d') AS \"decisionDate\", disposition, petitioner, respondent, citation, \"dateOfRegistration\", year_final AS year,
  CAST(floor((row_number() OVER (PARTITION BY year_final ORDER BY dt NULLS LAST, \"caseId\") - 1) / 100) AS INTEGER) + 1 AS page
FROM r WHERE year_final BETWEEN $YF AND $YT;
COPY (SELECT year, count(*) AS cases, max(page) AS pages FROM p GROUP BY year ORDER BY year DESC) TO '$OUT/_manifest/$s.json' (FORMAT JSON, ARRAY true);
COPY (SELECT count(*) AS cases, round(100.0*avg((title IS NOT NULL)::int),1) AS title, round(100.0*avg((\"caseNumber\" IS NOT NULL)::int),1) AS case_number,
  round(100.0*avg((\"decisionDate\" IS NOT NULL)::int),1) AS decision_date, round(100.0*avg((disposition IS NOT NULL)::int),1) AS disposition,
  round(100.0*avg((petitioner IS NOT NULL)::int),1) AS petitioner, round(100.0*avg((respondent IS NOT NULL)::int),1) AS respondent,
  round(100.0*avg((citation IS NOT NULL)::int),1) AS citation FROM p) TO '$OUT/_fields/$s.json' (FORMAT JSON, ARRAY false);
COPY (SELECT \"caseId\", title, \"caseNumber\", \"decisionDate\", disposition, petitioner, respondent, citation, \"dateOfRegistration\", year, page FROM p
      ORDER BY year, page, \"decisionDate\" NULLS LAST, \"caseId\") TO '$TMP/$s.ndjson' (FORMAT JSON, ARRAY false);
" >/dev/null
  python3 scripts/judgments/split_pages.py "$TMP/$s.ndjson" "$OUT/court=$s"; rm -f "$TMP/$s.ndjson"
done
echo "done: $(find "$OUT" -name 'data_0.json' | wc -l | tr -d ' ') page files, $(du -sh "$OUT" | cut -f1)" >&2
# A full run (no HC_COURTS / HC_YEARS filter) also refreshes the committed counts so they match the page files exactly:
# src/data/judgments/court-years.json and courts.meta.json keep their Supreme Court rows and take High Court rows from the manifests/quarantine.
if [ -z "${HC_COURTS:-}" ] && [ -z "${HC_YEARS:-}" ]; then
  CY=src/data/judgments/court-years.json; CM=src/data/judgments/courts.meta.json
  duckdb -c "
CREATE TEMP TABLE sc_cy AS SELECT * FROM read_json('$CY', columns={court:'VARCHAR', year:'INTEGER', cases:'BIGINT'}) WHERE court = 'supreme-court-of-india';
CREATE TEMP TABLE sc_cm AS SELECT * FROM read_json('$CM', columns={court:'VARCHAR', cases:'BIGINT', cases_without_valid_year:'BIGINT', first_year:'INTEGER', last_year:'INTEGER'}) WHERE court = 'supreme-court-of-india';
CREATE TEMP TABLE man AS SELECT regexp_extract(filename, '_manifest/(.*)\\.json', 1) AS court, year, cases FROM read_json('$OUT/_manifest/*.json', filename=true, columns={year:'INTEGER', cases:'BIGINT', pages:'INTEGER'});
CREATE TEMP TABLE q AS SELECT regexp_extract(filename, '_quarantine/(.*)\\.json', 1) AS court, count(*) AS n FROM read_json('$OUT/_quarantine/*.json', filename=true, columns={caseId:'VARCHAR', reason:'VARCHAR', decision_date_raw:'VARCHAR', year_raw:'VARCHAR'}) WHERE caseId IS NOT NULL GROUP BY 1;
CREATE TEMP TABLE cy AS SELECT * FROM sc_cy UNION ALL SELECT court, year, cases FROM man;
CREATE TEMP TABLE cm AS SELECT * FROM sc_cm UNION ALL
  SELECT m.court, sum(m.cases) + coalesce(max(q.n), 0), coalesce(max(q.n), 0), min(m.year), max(m.year) FROM man m LEFT JOIN q USING (court) GROUP BY m.court;
COPY (SELECT * FROM cy ORDER BY court, year DESC) TO '$CY' (FORMAT JSON, ARRAY true);
COPY (SELECT * FROM cm ORDER BY court) TO '$CM' (FORMAT JSON, ARRAY true);
" >/dev/null
  echo "refreshed court-years.json and courts.meta.json" >&2
fi
