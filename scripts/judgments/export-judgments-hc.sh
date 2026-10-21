#!/usr/bin/env bash
# High Court case-level export (metadata only, no judgment text) from the open-india-law snapshot (CC BY 4.0).
# Layout (hive-style, one JSON array per file, 100 cases per page, newest year first is a UI matter):
#   <OUT>/court=<slug>/year=<YYYY>/page=<N>/data_0.json      (written by split_pages.py) N starts at 1; cases sorted by decisionDate (nulls last), then caseId
#   <OUT>/court=<slug>/year=<YYYY>/disp=<label-slug>/page=<N>/data_0.json   same cases filtered by disposition chip (rows add mainPage)
#   <OUT>/court=<slug>/year=<YYYY>/bench=<single|division|larger>/page=<N>/data_0.json   same, filtered by bench class (3 courts only)
#   <OUT>/court=<slug>/year=<YYYY>/facets.json                {disposition:[{value,slug,count}], bench:[{value,count}]}
#   <OUT>/_manifest/<slug>.json                              [{year, cases, pages}]
#   <OUT>/_quarantine/<slug>.json                            cases left out, with the reason (never mixed into browse output)
#   <OUT>/_fields/<slug>.json                                fill rates per field, for docs/JUDGMENTS-HC.md
# Judges/bench size: exported only for courts in JUDGE_COURTS and only for cases whose judge entries are ALL name-like (the source field holds sentence fragments such as "therefore", "inter alia", "pass" in most courts).
# Rules live in export-judgments-hc.sql.
# Rules (see docs/JUDGMENTS-HC.md): the court comes from the FILE (25 canonical slugs), never from the free-text `court` column (50 spellings).
# Year = year of decision_date when it parses and lies in 1900-01-01..2026-08-31 (the snapshot end); if decision_date is blank, the record's `year`
# column when it is 1900..2026 (decisionDate stays null); anything else is quarantined. Never reads `text`; never orders or joins chunks.
# Usage: [HC_COURTS=delhi-high-court,bombay-high-court] [HC_YEARS=2024-2025] scripts/judgments/export-judgments-hc.sh [DATASET_DIR] [OUT_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; OUT="${2:-../lexbharat-data/judgments-hc}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR (is the SSD plugged in?)" >&2; exit 1; }
slug() { case "$1" in jammu-and-kashmir) echo high-court-of-jammu-and-kashmir-and-ladakh;; punjab-and-haryana) echo punjab-and-haryana-high-court;; *) echo "$1-high-court";; esac; }
YF=1900; YT=2026; if [ -n "${HC_YEARS:-}" ]; then YF="${HC_YEARS%-*}"; YT="${HC_YEARS#*-}"; fi
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# Courts whose judge field passed the check in docs/JUDGMENTS-HC.md (>=80% of cases have only name-like entries; Patna excluded: names glued to "ORAL").
JUDGE_COURTS="bombay-high-court gujarat-high-court orissa-high-court"
mkdir -p "$OUT/_manifest" "$OUT/_quarantine" "$OUT/_fields"
for f in "$DIR"/in_*_judgments.parquet; do
  stem="$(basename "$f" _judgments.parquet)"; stem="${stem#in_}"; [ "$stem" = "supreme-court" ] && continue
  s="$(slug "$stem")"
  if [ -n "${HC_COURTS:-}" ] && [[ ",$HC_COURTS," != *",$s,"* ]]; then continue; fi
  echo "exporting $s" >&2; rm -rf "$OUT/court=$s"
  JC=false; case " $JUDGE_COURTS " in *" $s "*) JC=true;; esac
  duckdb -c "$(sed -e "s|__FILE__|$f|g" -e "s|__OUT__|$OUT|g" -e "s|__TMP__|$TMP|g" -e "s|__SLUG__|$s|g" -e "s|__YF__|$YF|g" -e "s|__YT__|$YT|g" -e "s|__JUDGES__|$JC|g" scripts/judgments/export-judgments-hc.sql)"
  python3 scripts/judgments/split_pages.py "$TMP/$s.ndjson" "$OUT/court=$s"; rm -f "$TMP/$s.ndjson"
  python3 scripts/judgments/split_pages.py "$TMP/$s.filtered.ndjson" "$OUT/court=$s" --filtered; python3 scripts/judgments/split_pages.py "$TMP/$s.facets.ndjson" "$OUT/court=$s" --facets; rm -f "$TMP/$s.filtered.ndjson" "$TMP/$s.facets.ndjson"
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
