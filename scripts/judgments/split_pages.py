#!/usr/bin/env python3
"""Splits DuckDB NDJSON exports (already sorted) into hive-style files. Standard library only.
usage: split_pages.py <ndjson> <out_court_dir> [--filtered | --facets]
  (default)   rows {year, page, ...case}                  -> year=<Y>/page=<N>/data_0.json
  --filtered  rows {year, kind, key, page, ...case}       -> year=<Y>/<kind>=<key>/page=<N>/data_0.json   (kind: disp | bench)
  --facets    rows {year, disposition[], bench[]}         -> year=<Y>/facets.json
Null fields and empty lists are dropped to keep files small."""
import json, os, sys

src, out = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else ""
cur, buf, n_files = None, [], 0

def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))

def flush():
    global buf, n_files
    if cur is None or not buf:
        return
    if mode == "--filtered":
        year, kind, key, page = cur
        path = os.path.join(out, f"year={year}", f"{kind}={key}", f"page={page}", "data_0.json")
    else:
        path = os.path.join(out, f"year={cur[0]}", f"page={cur[1]}", "data_0.json")
    write(path, buf)
    n_files += 1
    buf = []

with open(src, encoding="utf-8") as fh:
    for line in fh:
        r = json.loads(line)
        if mode == "--facets":
            year = r.pop("year")
            write(os.path.join(out, f"year={year}", "facets.json"), {k: v for k, v in r.items() if v})
            n_files += 1
            continue
        key = (r.pop("year"), r.pop("kind"), r.pop("key"), r.pop("page")) if mode == "--filtered" else (r.pop("year"), r.pop("page"))
        if key != cur:
            flush()
            cur = key
        buf.append({k: v for k, v in r.items() if v is not None and v != []})
flush()
print(n_files, file=sys.stderr)
