#!/usr/bin/env bash
# Builds the Phase 3 processed subset (act-level regulator instruments) from the local SSD dataset. Usage: scripts/acts/export-regulations.sh [DATASET_DIR] [OUT_DIR]
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"; OUT="${2:-src/data/acts}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR (is the SSD plugged in?)" >&2; exit 1; }
mkdir -p "$OUT"
duckdb -c "$(sed -e "s|__DIR__|$DIR|g" -e "s|__OUT__|$OUT|g" scripts/acts/export-regulations.sql)"
cat "$OUT/acts.regulations.meta.json"; echo; cat "$OUT/acts.regulations.departments.json"; ls -la "$OUT"
