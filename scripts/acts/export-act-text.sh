#!/usr/bin/env bash
# Builds gzipped per-act section text (reassembled from chunks) plus quality flags, OUTSIDE the repo. Never commit the output.
# Usage: scripts/acts/export-act-text.sh [DATASET_DIR] [OUT_DIR]
#   defaults: /Volumes/LAWSSD/open-india-law  ->  ../lexbharat-data/acts-text
# Needs the DuckDB CLI and Node. Reads parquet only; the raw dataset is never copied or modified.
set -euo pipefail
cd "$(dirname "$0")/../.."
DIR="${1:-/Volumes/LAWSSD/open-india-law}"
OUT="${2:-../lexbharat-data/acts-text}"
[ -d "$DIR" ] || { echo "Dataset folder not found: $DIR (is the SSD plugged in?)" >&2; exit 1; }
# DuckDB writes the chunk rows to a temporary NDJSON file (piping /dev/stdout from several threads can cut lines), Node then reads it; the file is deleted after.
TMP="$(mktemp -d)/chunks.ndjson"
trap 'rm -rf "$(dirname "$TMP")"' EXIT
SQL="$(sed -e "s|__DIR__|$DIR|g" -e "s|__TMP__|$TMP|g" scripts/acts/export-act-text.sql)"
duckdb -c "$SQL"
node --max-old-space-size=4000 scripts/acts/build-act-text.mjs "$OUT" < "$TMP"
