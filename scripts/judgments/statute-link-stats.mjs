#!/usr/bin/env node
// How many Supreme Court judgments get at least one statute link, which sections are linked most, and 20 random links with their context for checking by hand.
// Reads the opening-text previews (JUDGMENTS_DATA_DIR/court=supreme-court-of-india/year=*/preview.json) and our Act sections in Neon. Read-only. usage: node scripts/judgments/statute-link-stats.mjs [--seed=1]
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { findMentions, mentionLabel } from "../../src/lib/judgments/statuteLinks.mjs";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const acts = JSON.parse(fs.readFileSync("src/config/statute-acts.json", "utf8"));
const root = path.resolve(process.env.JUDGMENTS_DATA_DIR), dir = path.join(root, "court=supreme-court-of-india");
const sql = neon(process.env.DATABASE_URL);
let seed = Number((process.argv.find((a) => a.startsWith("--seed=")) ?? "--seed=1").slice(7)); const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);

const cases = [];   // { year, id, text, mentions }
for (const y of fs.readdirSync(dir).filter((d) => d.startsWith("year=")).sort()) {
  const f = path.join(dir, y, "preview.json"); if (!fs.existsSync(f)) continue;
  const year = Number(y.slice(5)), data = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const [id, text] of Object.entries(data)) cases.push({ year, id, text, mentions: findMentions(text, year) });
}
const wanted = new Map();
for (const c of cases) for (const m of c.mentions) { const id = acts[m.actKey]; if (id) (wanted.get(id) ?? wanted.set(id, new Set()).get(id)).add(m.number); }
const found = new Set(), missingSet = new Set();
for (const [id, nums] of wanted) {
  for (const r of await sql.query(`SELECT number FROM act_sections_v WHERE act_id = $1 AND upper(number) = ANY($2::text[])`, [id, [...nums]])) found.add(`${id}|${r.number.toUpperCase()}`);
  const plain = [...nums].filter((n) => /^\d{1,4}$/.test(n)).map(Number);
  if (plain.length) for (const r of await sql.query(`SELECT m.number FROM act_missing_sections m WHERE m.act_id = $1 AND m.number = ANY($2::int[]) AND NOT EXISTS (SELECT 1 FROM act_sections_supplement x WHERE x.act_id = m.act_id AND x.number = m.number::text)`, [id, plain])) missingSet.add(`${id}|${r.number}`);
}
const stateOf = (m) => { const id = acts[m.actKey]; return !id ? "none" : found.has(`${id}|${m.number}`) ? "found" : missingSet.has(`${id}|${m.number}`) ? "missing" : "none"; };
const withText = cases.length, withMention = cases.filter((c) => c.mentions.length).length, linked = cases.filter((c) => c.mentions.some((m) => stateOf(m) === "found")).length, linkedAny = cases.filter((c) => c.mentions.some((m) => stateOf(m) !== "none")).length;
console.log(`Supreme Court previews read: ${withText}\n  with at least one Act/section/article mention: ${withMention}\n  with at least one link to a section we hold: ${linked} (${(100 * linked / withText).toFixed(1)}%)\n  with a link or a "missing from source data" link: ${linkedAny}`);
const perAct = new Map(); const perSec = new Map(); const unlinked = new Map();
for (const c of cases) { const seen = new Set(); for (const m of c.mentions) { const st = stateOf(m), k = `${m.actName} — ${mentionLabel(m)}`; if (seen.has(k)) continue; seen.add(k); if (st === "found") { perSec.set(k, (perSec.get(k) ?? 0) + 1); perAct.set(m.actName, (perAct.get(m.actName) ?? 0) + 1); } else unlinked.set(`${m.actName}${acts[m.actKey] ? " (section not in our data)" : " (Act not in our data)"}`, (unlinked.get(`${m.actName}${acts[m.actKey] ? " (section not in our data)" : " (Act not in our data)"}`) ?? 0) + 1); } }
console.log("\nTop 20 most-linked sections (number of judgments):"); [...perSec].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, n], i) => console.log(`  ${String(i + 1).padStart(2)}. ${String(n).padStart(5)}  ${k}`));
console.log("\nLinks per Act (judgments):"); [...perAct].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
console.log("\nMentions left unlinked (judgments):"); [...unlinked].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  ${k}`));
const links = cases.flatMap((c) => c.mentions.filter((m) => stateOf(m) === "found").map((m) => ({ c, m })));
console.log(`\n20 random links to check by hand (of ${links.length}):`);
for (let i = 0; i < 20 && links.length; i++) { const { c, m } = links.splice(Math.floor(rnd() * links.length), 1)[0]; console.log(`\n  [${i + 1}] ${c.year} case ${c.id}\n      -> ${m.actName}, ${mentionLabel(m)}\n      …${c.text.slice(Math.max(0, m.start - 70), m.end + 50).replace(/\s+/g, " ")}…`); }
