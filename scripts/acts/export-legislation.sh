#!/usr/bin/env bash
# Builds the Phase 1 processed subset (act-level legislation metadata) from the local SSD dataset.
# Usage: scripts/acts/export-legislation.sh [DATASET_DIR] [OUT_DIR]
# Needs the DuckDB CLI. Reads parquet only; writes two small JSON files. The raw dataset is never copied or modified.
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"
OUT="${2:-src/data/acts}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR (is the SSD plugged in?)" >&2; exit 1; }
mkdir -p "$OUT"
SQL="$(sed -e "s|__DIR__|$DIR|g" -e "s|__OUT__|$OUT|g" scripts/acts/export-legislation.sql)"
duckdb -c "$SQL"
echo; cat "$OUT/acts.legislation.meta.json"; ls -la "$OUT"
