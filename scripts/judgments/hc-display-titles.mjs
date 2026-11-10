#!/usr/bin/env node
// Export step between DuckDB and split_pages.py: turns each row's titleRaw into `title` with the A225 rule (src/lib/judgments/displayTitle.ts, the port of
// core/display_title.py) and removes titleRaw, so the raw title never reaches a page. A title that cannot be cleaned is left out (null) and counted by
// reason in _removed/<slug>.json: title_shown, title_cleaned (a tail was cut), title_dropped, title_dropped_reasons. Rows keep their order. The guard
// (check-hc-output.mjs) is the hard fail behind this.
// usage: node scripts/judgments/hc-display-titles.mjs <removed.json> <ndjson> [<ndjson> ...]   (counts come from the first file: the main list)
import { createReadStream, createWriteStream, readFileSync, renameSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { explainTitle } from "../../src/lib/judgments/displayTitle.ts";

const [removedPath, ...files] = process.argv.slice(2);
const counts = { shown: 0, cleaned: 0, dropped: 0, reasons: {} };
for (const [fi, file] of files.entries()) {
  const out = createWriteStream(`${file}.tmp`);
  for await (const line of createInterface({ input: createReadStream(file), crlfDelay: Infinity })) {
    if (!line) continue;
    const { titleRaw, ...row } = JSON.parse(line);
    const [shown, reason] = explainTitle(titleRaw);
    if (shown) row.title = shown;
    if (fi === 0 && titleRaw) { if (shown) { counts.shown++; if (shown !== titleRaw) counts.cleaned++; } else { counts.dropped++; counts.reasons[reason] = (counts.reasons[reason] ?? 0) + 1; } }
    if (!out.write(JSON.stringify(row) + "\n")) await once(out, "drain");
  }
  out.end(); await once(out, "finish"); renameSync(`${file}.tmp`, file);
}
const removed = JSON.parse(readFileSync(removedPath, "utf8"));
writeFileSync(removedPath, JSON.stringify({ ...removed, title_shown: counts.shown, title_cleaned: counts.cleaned, title_dropped: counts.dropped, title_dropped_reasons: counts.reasons }));
