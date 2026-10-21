#!/usr/bin/env bash
# Supreme Court fields extracted from report text: full bench and case number. Rewrites src/data/judgments/sc/<year>.json (run AFTER export-judgments.sh,
# which creates those files; export-judgments.sh calls this script itself). Rules are in extract-sc-fields.py. Usage: scripts/judgments/export-sc-fields.sh [DATASET_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; F="$DIR/in_supreme-court_judgments.parquet"
[ -f "$F" ] || { echo "Supreme Court file not found in $DIR" >&2; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
duckdb -c "
COPY (SELECT case_id AS \"caseId\", left(trim(regexp_replace(regexp_replace(regexp_replace(any_value(text), '^Case:[^\n]*\n+Section:[^\n]*\n*', ''), '\[(SECTION|TITLE)\]\s*(#+)?\s*', ' ', 'g'), '\s+', ' ', 'g')), 3000) AS text
      FROM read_parquet('$F') WHERE language_code = 'en' AND char_start = 0 GROUP BY case_id HAVING count(*) = 1) TO '$TMP/opening.ndjson' (FORMAT JSON, ARRAY false);
COPY (SELECT case_id AS \"caseId\", any_value(judges) AS judges FROM read_parquet('$F') GROUP BY case_id) TO '$TMP/judges.ndjson' (FORMAT JSON, ARRAY false);" >/dev/null
python3 scripts/judgments/extract-sc-fields.py "$TMP/opening.ndjson" "$TMP/judges.ndjson"
