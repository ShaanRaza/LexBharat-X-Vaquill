#!/usr/bin/env python3
"""Splits a DuckDB NDJSON export (sorted by year, page) into hive-style page files. Standard library only.
usage: split_pages.py <ndjson> <out_court_dir>
Writes <out_court_dir>/year=<Y>/page=<N>/data_0.json as a JSON array. Null fields are dropped to keep files small."""
import json, os, sys

src, out = sys.argv[1], sys.argv[2]
cur, buf, n_files = None, [], 0

def flush():
    global buf, n_files
    if cur is None or not buf:
        return
    d = os.path.join(out, f"year={cur[0]}", f"page={cur[1]}")
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, "data_0.json"), "w", encoding="utf-8") as f:
        json.dump(buf, f, ensure_ascii=False, separators=(",", ":"))
    n_files += 1
    buf = []

with open(src, encoding="utf-8") as fh:
    for line in fh:
        r = json.loads(line)
        key = (r.pop("year"), r.pop("page"))
        if key != cur:
            flush()
            cur = key
        buf.append({k: v for k, v in r.items() if v is not None and v != []})
flush()
print(n_files, file=sys.stderr)
