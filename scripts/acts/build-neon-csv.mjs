#!/usr/bin/env node
// Turns ../lexbharat-data/acts-text/*.json.gz into two CSV files for psql \copy (acts.csv, sections.csv). usage: node scripts/acts/build-neon-csv.mjs <TEXT_DIR> <OUT_DIR>
import { readdirSync, readFileSync, createWriteStream } from "node:fs";
import { gunzipSync } from "node:zlib";
import { once } from "node:events";
import path from "node:path";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";
import { confidentMissing } from "../../src/lib/acts/missing.mjs";

const [IN, OUT] = [path.resolve(process.argv[2]), path.resolve(process.argv[3])];
const q = (v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`); // unquoted empty = NULL
const arr = (a) => q(`{${a.map((x) => `"${x}"`).join(",")}}`);
const acts = createWriteStream(path.join(OUT, "acts.csv")), secs = createWriteStream(path.join(OUT, "sections.csv")), miss = createWriteStream(path.join(OUT, "missing.csv"));
const write = async (s, line) => { if (!s.write(line)) await once(s, "drain"); };
let nA = 0, nS = 0, nHidden = 0, nMissing = 0, actsWithMissing = 0;
for (const f of readdirSync(IN).filter((x) => x.endsWith(".json.gz")).sort()) {
  const d = JSON.parse(gunzipSync(readFileSync(path.join(IN, f))));
  const recs = d.sections.map((s, i) => toSectionRecord(s, i));
  await write(acts, [q(d.actId), q(d.title), d.year ?? "", q(d.jurisdiction), q(d.state), q(d.actStatus), q(d.sourceUrl), d.sections.filter((s) => s.kind === "s").length].join(",") + "\n");
  nA++;
  const cm = confidentMissing(recs.map((r) => ({ number: r.number, body: r.body })), d.title);
  if (cm.numbers.length) actsWithMissing++;
  for (const n of cm.numbers) { await write(miss, `${q(d.actId)},${n}\n`); nMissing++; }
  for (const r of recs) {
    await write(secs, [q(d.actId), q(r.sectionKey), r.ord, q(r.number), q(r.heading), q(r.chapter), q(r.status), arr(r.flags), r.chunkCount, q(r.body)].join(",") + "\n");
    nS++; if (r.body === null) nHidden++;
  }
}
acts.end(); secs.end(); miss.end(); await Promise.all([once(acts, "finish"), once(secs, "finish"), once(miss, "finish")]);
console.log(JSON.stringify({ acts: nA, sections: nS, sectionsWithoutText: nHidden, confidentMissingNumbers: nMissing, actsWithConfidentMissing: actsWithMissing }));
