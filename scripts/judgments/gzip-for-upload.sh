#!/usr/bin/env bash
# Writes a gzip-compressed copy of the High Court export for upload (about a fifth of the size), keeping every file name unchanged.
# Upload it with Content-Encoding: gzip so browsers and the app's fetch() decompress it transparently; see docs/JUDGMENTS-HC.md.
# Both folders live OUTSIDE the project (../lexbharat-data): hundreds of thousands of files inside the project folder make `next build` run out of memory.
# Usage: scripts/judgments/gzip-for-upload.sh [SRC=../lexbharat-data/judgments-hc] [DEST=../lexbharat-data/judgments-hc-gz]
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC="$(cd "${1:-../lexbharat-data/judgments-hc}" && pwd)"; DEST="${2:-../lexbharat-data/judgments-hc-gz}"
rm -rf "$DEST"; mkdir -p "$DEST"; DEST="$(cd "$DEST" && pwd)"
cd "$SRC"
# only the files the app reads: data_0.json, facets.json and preview.json under court=*, and the search index under search/ (not the _manifest, _quarantine, _fields folders)
find court=* search -type f \( -name data_0.json -o -name facets.json -o -name preview.json -o -name 'shard=*.json' -o -name meta.json \) -print0 | while IFS= read -r -d '' f; do
  mkdir -p "$DEST/$(dirname "$f")"; gzip -9 -n -c "$f" > "$DEST/$f"
done
echo "done: $(find "$DEST" -type f | wc -l | tr -d ' ') files, $(du -sh "$DEST" | cut -f1)" >&2
