#!/usr/bin/env node
// Counts how often each Act, and each section of it, is cited in Supreme Court judgments. READ-ONLY: streams the full judgment text from Neon (SC_DATABASE_URL, table sc_cases), writes one JSON file.
// An Act "name as written" is "<Name> Act|Code|Sanhita|Adhiniyam, YYYY" (same rule as scripts/acts/sc-act-mentions.sql); the 17 very common short forms (IPC, CrPC, NI Act ...) come from src/lib/judgments/statuteLinks.mjs and are stored under "~<key>".
// A section is counted when the text says "Section N of/under the <Act, YYYY>" or "<Act, YYYY>, Section N" within a short distance. Counts are DISTINCT JUDGMENTS, not mentions. Approximate by nature (regex on prose): good for ranking, not for exact claims.
// usage: node scripts/acts/sc-citations-scan.mjs <out.json> [--limit N]      (about 15 minutes for all 35,596 cases; resumable is not needed, it only reads)
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import { findMentions } from "../../src/lib/judgments/statuteLinks.mjs";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const OUT = process.argv[2], LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
if (!OUT) { console.log("usage: node scripts/acts/sc-citations-scan.mjs <out.json> [--limit N]"); process.exit(1); }
const sql = neon(process.env.SC_DATABASE_URL);
const toBuffer = (v) => (typeof v === "string" ? Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") : Buffer.from(v));
const R1 = /((?:[A-Z][A-Za-z&()'\-]*\s+){1,7}(?:Act|Code|Sanhita|Adhiniyam)),?\s+(?:No\.\s*[0-9]+\s+of\s+)?(?:of\s+)?([12][0-9]{3})/g;
const R2 = /((?:Code of (?:Civil|Criminal) Procedure|(?:Civil|Criminal) Procedure Code)),?\s+(?:of\s+)?([12][0-9]{3})/g;
const key = (s) => s.replace(/[,.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const BEFORE = /(?:Sections?|Sec\.|Ss?\.)\s*([0-9][0-9A-Za-z(),\s&\-–]{0,50}?)\s*(?:of|under|in)\s+(?:the\s+)?$/;
const AFTER = /^\s*[,(]?\s*(?:Section|Sec\.|s\.)\s*(\d{1,4}[A-Z]{0,2})/;
const nums = (s) => [...new Set((s.match(/\d{1,4}[A-Z]{0,2}(?![a-z])/g) ?? []).filter((n) => !/^(1[89]|20)\d\d$/.test(n)))].slice(0, 6);

const caseIds = [], variants = new Map(), sections = new Map();   // key -> Set(case index)
const add = (m, k, i) => (m.get(k) ?? m.set(k, new Set()).get(k)).add(i);
let last = "", seen = 0; const t0 = Date.now();
while (seen < LIMIT) {
  const rows = await sql.query("SELECT case_id, blob FROM sc_cases WHERE case_id > $1 ORDER BY case_id LIMIT 120", [last]);
  if (!rows.length) break;
  for (const r of rows) {
    last = r.case_id; if (seen >= LIMIT) break; seen++;
    let text; try { text = JSON.parse(gunzipSync(toBuffer(r.blob)).toString("utf8")).map((c) => c.t).join("\n"); } catch { continue; }
    const i = caseIds.push(r.case_id) - 1, year = Number((/^(\d{4})_/.exec(r.case_id) ?? [])[1]) || null;
    for (const re of [R1, R2]) { re.lastIndex = 0; for (let m; (m = re.exec(text)); ) {
      const k = key(`${m[1]} ${m[2]}`); add(variants, k, i);
      const b = BEFORE.exec(text.slice(Math.max(0, m.index - 110), m.index)); if (b) for (const n of nums(b[1])) add(sections, `${k}|${n}`, i);
      const a = AFTER.exec(text.slice(m.index + m[0].length, m.index + m[0].length + 40)); if (a) add(sections, `${k}|${a[1]}`, i);
    } }
    for (const m of findMentions(text, year)) { add(variants, `~${m.actKey}`, i); add(sections, `~${m.actKey}|${String(m.number).toUpperCase()}`, i); }
  }
  if (seen % 1200 < 120) console.log(`${seen} cases, ${variants.size} act names, ${((Date.now() - t0) / 60000).toFixed(1)} min`);
}
const keep = (m, min) => Object.fromEntries([...m].filter(([, s]) => s.size >= min).map(([k, s]) => [k, [...s]]));
fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), cases: caseIds, variants: keep(variants, 3), sections: keep(sections, 3) }));
console.log(`done: ${caseIds.length} cases, ${variants.size} names (kept ${Object.keys(keep(variants, 3)).length} with 3+), written ${OUT}`);
