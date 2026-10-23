#!/usr/bin/env node
// Bake-off step 1: writes every CENTRAL Act chunk (rule: src/lib/acts/chunking.mjs) to ../lexbharat-data/vectors/central-chunks.jsonl (outside the repo, never committed).
import { readdirSync, readFileSync, createWriteStream } from "node:fs";
import { gunzipSync } from "node:zlib";
import { once } from "node:events";
import path from "node:path";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";
import { chunkSection } from "../../src/lib/acts/chunking.mjs";

const IN = path.resolve("../lexbharat-data/acts-text"), OUT = path.resolve("../lexbharat-data/vectors/central-chunks.jsonl");
const w = createWriteStream(OUT);
let i = 0, chars = 0;
for (const f of readdirSync(IN).filter((x) => x.endsWith(".json.gz")).sort()) {
  const d = JSON.parse(gunzipSync(readFileSync(path.join(IN, f))));
  if (d.jurisdiction !== "central") continue;
  d.sections.forEach((s, k) => {
    const r = toSectionRecord(s, k);
    for (const c of chunkSection({ actTitle: d.title, year: d.year, number: r.number, heading: r.heading, body: r.body })) {
      w.write(JSON.stringify({ i: i++, actId: d.actId, sectionKey: r.sectionKey, part: c.part, text: c.text }) + "\n"); chars += c.text.length;
    }
  });
}
w.end(); await once(w, "finish");
console.log(JSON.stringify({ chunks: i, chars, estTokensAt4_36CharsPerToken: Math.round(chars / 4.36) }));
