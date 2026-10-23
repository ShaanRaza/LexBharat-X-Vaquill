#!/usr/bin/env node
// MEASURE ONLY (no embedding): how many chunks Central + State section text splits into, and how big they are. usage: node scripts/acts/plan-chunks.mjs [TEXT_DIR]
import { readdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";
import { chunkSection } from "../../src/lib/acts/chunking.mjs";

const DIR = path.resolve(process.argv[2] ?? "../lexbharat-data/acts-text");
const lens = [], by = { central: 0, state: 0 }, bytesBy = { central: 0, state: 0 };
let sections = 0, withText = 0, tiny = 0;
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json.gz"))) {
  const d = JSON.parse(gunzipSync(readFileSync(path.join(DIR, f))));
  d.sections.forEach((s, i) => {
    sections++;
    const r = toSectionRecord(s, i);
    const cs = chunkSection({ actTitle: d.title, year: d.year, number: r.number, heading: r.heading, body: r.body });
    if (!cs.length) return;
    withText++;
    for (const c of cs) { lens.push(c.text.length); by[d.jurisdiction] = (by[d.jurisdiction] ?? 0) + 1; bytesBy[d.jurisdiction] = (bytesBy[d.jurisdiction] ?? 0) + c.text.length; if (c.text.length < 300) tiny++; }
  });
}
lens.sort((a, b) => a - b);
const sum = lens.reduce((a, b) => a + b, 0), pct = (p) => lens[Math.floor(lens.length * p)];
console.log(JSON.stringify({ sectionsSeen: sections, sectionsWithText: withText, chunks: lens.length, byJurisdiction: by, totalChars: sum, avgChars: Math.round(sum / lens.length), medianChars: pct(0.5), p90: pct(0.9), p99: pct(0.99), max: lens.at(-1),
  estTokensAvg: Math.round(sum / lens.length / 4), estTokensTotal: Math.round(sum / 4), chunksUnder300chars: tiny }, null, 1));
