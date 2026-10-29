#!/usr/bin/env node
// READ-ONLY scan of the full text of Supreme Court judgments (sc_cases): how many judgments show each extraction-junk pattern, and the short lines that repeat in many judgments (running heads, signature stamps).
// usage: node scripts/audit/junk-scan-judgments.mjs <out.json> [--limit N]
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const OUT = process.argv[2], LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
const sql = neon(process.env.SC_DATABASE_URL), toBuf = (v) => (typeof v === "string" ? Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") : Buffer.from(v));
const P = {
  "picture omitted marker": /==>|<==/, "amendment-style number before a bracket": /(^|[^0-9A-Za-z])[0-9]{1,2}\[/, "markdown bold": /\*\*/, "markdown italics": /(^|\s)_[A-Za-z][^_\n]{0,60}_(\s|[.,;:]|$)/, "markdown heading": /(^|\n)#{1,6}\s/,
  "spaced brackets ( a )": /\(\s+[A-Za-z0-9]{1,4}\s+\)/, "space before punctuation": /[a-z] [.,;:](\s|$)/, "replacement character": /�/, "HTML tag or entity": /<\/?[a-z]{1,6}>|&(amp|nbsp|lt|gt|quot);/,
  "Page N line": /(^|\n)\s*Page\s+\d+\s*($|\n)/, "digital signature stamp": /Digitally signed by|Signature Not Verified|Reason:|Date: 20\d\d\.\d\d\.\d\d/, "letter-spaced word (C H A P T E R)": /(?<![A-Za-z0-9])(?:[A-Za-z] ){5,}[A-Za-z](?![A-Za-z0-9])/,
  "form feed or control character": /[\x00-\x08\x0b\x0c\x0e-\x1f]/, "backslash escape": /\\[nrtu]/,
};
const counts = Object.fromEntries(Object.keys(P).map((k) => [k, { cases: 0, sample: null }])), lines = new Map(); let seen = 0, last = "";
while (seen < LIMIT) {
  const rows = await sql.query("SELECT case_id, blob FROM sc_cases WHERE case_id > $1 ORDER BY case_id LIMIT 120", [last]); if (!rows.length) break;
  for (const r of rows) {
    last = r.case_id; if (seen++ >= LIMIT) break;
    let text; try { text = JSON.parse(gunzipSync(toBuf(r.blob)).toString("utf8")).map((c) => c.t).join("\n"); } catch { continue; }
    for (const [k, re] of Object.entries(P)) { const m = re.exec(text); if (m) { counts[k].cases++; counts[k].sample ??= text.slice(Math.max(0, m.index - 40), m.index + 70).replace(/\s+/g, " "); } }
    const uniq = new Set(text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length >= 4 && l.length <= 80)); for (const l of uniq) lines.set(l, (lines.get(l) ?? 0) + 1);
  }
  if (seen % 6000 < 120) { console.log(`${seen} cases`); for (const [k, v] of lines) if (v === 1 && lines.size > 3e6) lines.delete(k); }
}
const repeated = [...lines].filter(([, n]) => n >= 150).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([line, cases]) => ({ line, cases }));
for (const [k, v] of Object.entries(counts)) console.log(`${String(v.cases).padStart(6)} | ${k}${v.sample ? "  e.g. " + JSON.stringify(v.sample.slice(0, 90)) : ""}`);
console.log("\nshort lines repeated in 150+ judgments:"); for (const r of repeated.slice(0, 25)) console.log(`${String(r.cases).padStart(6)} | ${r.line}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), cases: seen, counts, repeated }, null, 1));
