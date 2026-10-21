#!/usr/bin/env bash
# Phase 2 export: CASE-LEVEL judgment metadata only, from the open-india-law snapshot (CC BY 4.0).
#  - court-years.json: per court and decision year, the number of distinct case_id (all 26 courts). Aggregates only, no case rows.
#  - sc/<year>.json: one row per Supreme Court case (metadata, no text), split by year so a page loads one small file.
# Never selects `text` / `text_original`, never orders or joins chunks. Usage: scripts/judgments/export-judgments.sh [DATASET_DIR] [OUT_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; OUT="${2:-src/data/judgments}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR" >&2; exit 1; }
TMP="$(mktemp -d)"; mkdir -p "$OUT/sc"; rm -f "$OUT"/sc/*.json
slug() { case "$1" in
  supreme-court) echo supreme-court-of-india;; jammu-and-kashmir) echo high-court-of-jammu-and-kashmir-and-ladakh;;
  punjab-and-haryana) echo punjab-and-haryana-high-court;; *) echo "$1-high-court";; esac; }
for f in "$DIR"/in_*_judgments.parquet; do
  stem="$(basename "$f" _judgments.parquet)"; stem="${stem#in_}"; s="$(slug "$stem")"
  echo "aggregating $stem -> $s" >&2
  duckdb -c "COPY (SELECT '$s' AS court,
      coalesce(try_cast(left(trim(decision_date),4) AS INTEGER), try_cast(year AS INTEGER)) AS yr,
      count(DISTINCT case_id) AS cases
    FROM read_parquet('$f') GROUP BY 2) TO '$TMP/$s.csv' (HEADER, DELIMITER ',')"
done
duckdb -c "
CREATE TEMP TABLE cy AS SELECT * FROM read_csv('$TMP/*.csv', header=true, columns={'court':'VARCHAR','yr':'INTEGER','cases':'BIGINT'});
-- plausible years only; the rest is reported, not hidden
COPY (SELECT court, yr AS year, sum(cases)::BIGINT AS cases FROM cy WHERE yr BETWEEN 1900 AND 2026 GROUP BY 1,2 ORDER BY 1,2 DESC) TO '$OUT/court-years.json' (FORMAT JSON, ARRAY true);
COPY (SELECT court, sum(cases)::BIGINT AS cases, sum(cases) FILTER (yr IS NULL OR yr NOT BETWEEN 1900 AND 2026)::BIGINT AS cases_without_valid_year, min(yr) FILTER (yr BETWEEN 1900 AND 2026) AS first_year, max(yr) FILTER (yr BETWEEN 1900 AND 2026) AS last_year FROM cy GROUP BY 1 ORDER BY 1) TO '$OUT/courts.meta.json' (FORMAT JSON, ARRAY true);
"
echo "exporting Supreme Court case metadata" >&2
duckdb -c "
COPY (
  SELECT case_id AS \"caseId\", any_value(trim(title)) AS title, any_value(nullif(trim(citation),'')) AS citation, any_value(nullif(trim(disposition),'')) AS disposition,
    any_value(nullif(trim(decision_date),'')) AS \"decisionDate\", any_value(nullif(trim(petitioner),'')) AS petitioner, any_value(nullif(trim(respondent),'')) AS respondent,
    any_value(nullif(trim(case_number),'')) AS \"caseNumber\", any_value(CAST(bench_strength AS INTEGER)) AS \"benchStrength\", any_value(judges) AS judges,
    coalesce(try_cast(left(any_value(trim(decision_date)),4) AS INTEGER), any_value(CAST(year AS INTEGER))) AS year
  FROM read_parquet('$DIR/in_supreme-court_judgments.parquet') GROUP BY case_id
) TO '$TMP/sc.parquet' (FORMAT PARQUET)"
for y in $(duckdb -noheader -list -c "SELECT DISTINCT year FROM '$TMP/sc.parquet' WHERE year BETWEEN 1900 AND 2026 ORDER BY 1"); do
  duckdb -c "COPY (SELECT * EXCLUDE (year) FROM '$TMP/sc.parquet' WHERE year = $y ORDER BY \"decisionDate\", \"caseId\") TO '$OUT/sc/$y.json' (FORMAT JSON, ARRAY true)"
done
rm -rf "$TMP"; ls "$OUT/sc" | wc -l; du -sh "$OUT"
# Fields extracted from report text (full bench, case number) are merged into the year files just written.
scripts/judgments/export-sc-fields.sh "$DIR"
