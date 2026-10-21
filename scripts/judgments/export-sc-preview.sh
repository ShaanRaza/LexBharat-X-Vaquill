#!/usr/bin/env bash
# Supreme Court opening-text previews -> <OUT>/court=supreme-court-of-india/year=<YYYY>/preview.json  ({caseId: text}). See export-sc-preview.sql for the rules.
# Usage: scripts/judgments/export-sc-preview.sh [DATASET_DIR] [OUT_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; OUT="${2:-../lexbharat-data/judgments-hc}"
[ -f "$DIR/in_supreme-court_judgments.parquet" ] || { echo "Supreme Court file not found in $DIR" >&2; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT; mkdir -p "$OUT/_fields"
rm -f "$OUT"/court=supreme-court-of-india/year=*/preview.json
duckdb -c "$(sed -e "s|__FILE__|$DIR/in_supreme-court_judgments.parquet|g" -e "s|__OUT__|$OUT|g" -e "s|__TMP__|$TMP|g" scripts/judgments/export-sc-preview.sql)" >/dev/null
python3 scripts/judgments/split_pages.py "$TMP/sc-preview.ndjson" "$OUT/court=supreme-court-of-india" --preview
cat "$OUT/_fields/sc-preview.json"; echo
