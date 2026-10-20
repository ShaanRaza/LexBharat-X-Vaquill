#!/usr/bin/env bash
# Writes a gzip-compressed copy of the High Court export for upload (about a fifth of the size), keeping every file name unchanged.
# Upload it with Content-Encoding: gzip so browsers and the app's fetch() decompress it transparently; see docs/JUDGMENTS-HC.md.
# Usage: scripts/judgments/gzip-for-upload.sh [SRC=data/judgments-hc] [DEST=data/judgments-hc-gz]
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC="${1:-data/judgments-hc}"; DEST="${2:-data/judgments-hc-gz}"
rm -rf "$DEST"; mkdir -p "$DEST"
cd "$SRC"
# only the files the app reads: court=*/**/data_0.json and court=*/year=*/facets.json (not the _manifest, _quarantine, _fields folders)
find court=* -type f \( -name data_0.json -o -name facets.json \) -print0 | while IFS= read -r -d '' f; do
  mkdir -p "../$(basename "$DEST")/$(dirname "$f")"; gzip -9 -n -c "$f" > "../$(basename "$DEST")/$f"
done
echo "done: $(find "../$(basename "$DEST")" -type f | wc -l | tr -d ' ') files, $(du -sh "../$(basename "$DEST")" | cut -f1)" >&2
