#!/usr/bin/env node
// W10 data check: how much of the stored Supreme Court judgment text is REPEATED text. Reads every case blob from SC_DATABASE_URL (sc_cases) and measures, per case:
//   - chunk overlaps: the dataset cuts judgments into chunks that overlap by ~350 characters; if a loader joins the chunks as they are, that text appears twice (the start of chunk N+1 = the end of chunk N);
//   - source repeats: a run of 8 words that occurs 3 or more times in the case after overlaps are removed (the printed report's own text layer repeats itself in some places, for example 2005_INSC_103).
// usage: node scripts/w10/sc-overlap-report.mjs [--sample=N]
import { gunzipSync } from "node:zlib";
import { q as _q } from "./env.mjs";
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
const sql = neon(env.SC_DATABASE_URL), SAMPLE = Number((process.argv.find((a) => a.startsWith("--sample=")) ?? "").slice(9)) || 0;
const unpack = (b) => JSON.parse(gunzipSync(Buffer.from(typeof b === "string" ? b.replace(/^\\x/, "") : b, typeof b === "string" ? "hex" : undefined)).toString());
/** overlap length between the end of `a` and the start of `b` (0 if none): b's first 60 characters found inside a's tail, and the rest of a equals b's start exactly. */
export function overlapLen(a, b) {
  if (a.length < 80 || b.length < 60) return 0;
  const probe = b.slice(0, 60), at = a.lastIndexOf(probe);
  if (at < 0) return 0;
  const ov = a.length - at;
  return b.startsWith(a.slice(at)) ? ov : 0;
}
const ids = (await sql.query("SELECT case_id FROM sc_cases ORDER BY case_id")).map((r) => r.case_id);
const use = SAMPLE ? ids.filter((_, i) => i % Math.ceil(ids.length / SAMPLE) === 0) : ids;
let cases = 0, withOverlap = 0, pairs = 0, ovChars = 0, chars = 0, srcRepeat = 0, srcRepeatSevere = 0; const worst = [];
for (let i = 0; i < use.length; i += 200) {
  const batch = use.slice(i, i + 200), rows = await sql.query("SELECT case_id, blob FROM sc_cases WHERE case_id = ANY($1::text[])", [batch]);
  for (const r of rows) {
    const ch = unpack(r.blob); cases++; let ov = 0, np = 0; const clean = [];
    for (let k = 0; k < ch.length; k++) { const prev = k ? ch[k - 1].t : ""; const o = k ? overlapLen(prev, ch[k].t) : 0; if (o) { np++; ov += o; } clean.push(o ? ch[k].t.slice(o) : ch[k].t); chars += ch[k].t.length; }
    if (np) withOverlap++; pairs += np; ovChars += ov;
    const words = clean.join(" ").split(/\s+/), seen = new Map(); let rep = 0;
    for (let w = 0; w + 8 <= words.length; w += 1) { const sh = words.slice(w, w + 8).join(" ").toLowerCase(); seen.set(sh, (seen.get(sh) ?? 0) + 1); }
    for (const v of seen.values()) if (v >= 3) rep++;
    const share = seen.size ? rep / seen.size : 0;
    if (share >= 0.01) srcRepeat++; if (share >= 0.05) { srcRepeatSevere++; worst.push([r.case_id, +(share * 100).toFixed(1)]); }
  }
}
worst.sort((a, b) => b[1] - a[1]);
console.log(JSON.stringify({ casesChecked: cases, casesWithChunkOverlap: withOverlap, overlappingBoundaries: pairs, repeatedChars: ovChars, totalChars: chars, pctRepeated: +(100 * ovChars / chars).toFixed(2), casesWithSourceRepeats_1pct: srcRepeat, casesWithSourceRepeats_5pct: srcRepeatSevere, worstSourceRepeats: worst.slice(0, 8) }, null, 1));
