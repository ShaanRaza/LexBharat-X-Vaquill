#!/usr/bin/env node
// W10 item 4: the missing-number checker on ALL Central Acts (1,590), counting what we filled since (act_sections_supplement). Reports only; writes JSON for docs/MISSING-SECTIONS.md.
// usage: node scripts/w10/missing-all-central.mjs <top100.json> <out.json>
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { q } from "./env.mjs";
import { findGaps, maxCitedSection, robustMax, startsWithOwnNumber } from "../../src/lib/acts/gaps.mjs";
import { knownMaxFor } from "../../src/lib/acts/knownCounts.mjs";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";

const DIR = path.resolve("../lexbharat-data/acts-text"), PARQ = "/Volumes/LAWSSD/open-india-law";
const top100 = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), OUT = process.argv[3];
const idx = JSON.parse(fs.readFileSync(path.join(DIR, "_index.json"), "utf8")).filter((a) => a.jurisdiction === "central");
const acts = await q("SELECT act_id, title, act_status, year, category, section_count FROM acts WHERE category = 'central'");
const byId = new Map(acts.map((a) => [a.act_id, a]));
const supp = await q("SELECT act_id, number, replaces FROM act_sections_supplement");
const suppBy = new Map(); for (const s of supp) (suppBy.get(s.act_id) ?? suppBy.set(s.act_id, []).get(s.act_id)).push(s);
const stored = await q("SELECT act_id, count(*)::int n FROM act_missing_sections GROUP BY 1");
const storedBy = new Map(stored.map((r) => [r.act_id, r.n]));
const ids = idx.map((a) => `'${a.actId}'`).join(",");
let coll = new Map();
try {
  const collRows = JSON.parse(execFileSync("duckdb", ["-json", "-c", `SELECT act_id, section_number, count(DISTINCT lower(regexp_replace(regexp_extract(split_part(text, chr(10), 2), 'Section [^:]+: (.*)$', 1), '[^a-zA-Z0-9]+', '', 'g'))) AS titles FROM read_parquet('${PARQ}/in_*_legislation.parquet') WHERE act_id IN (${ids}) AND coalesce(section_number,'') <> '' GROUP BY 1, 2 HAVING titles >= 3`], { maxBuffer: 1 << 28 }).toString() || "[]");
  for (const r of collRows) (coll.get(r.act_id) ?? coll.set(r.act_id, []).get(r.act_id)).push(r.section_number);
} catch (e) { console.error("collision query skipped:", String(e.message).slice(0, 120)); }
const rows = [];
for (const a of idx) {
  const meta = byId.get(a.actId); if (!meta) continue;
  let d; try { d = JSON.parse(gunzipSync(fs.readFileSync(path.join(DIR, `act=${a.actId}.json.gz`)))); } catch { continue; }
  const sup = suppBy.get(a.actId) ?? [], filled = new Set(sup.filter((s) => /^\d/.test(s.number)).map((s) => s.number)), replaced = new Set(sup.filter((s) => s.replaces && /^\d/.test(s.number)).map((s) => s.number));
  const recs = d.sections.map((s, i) => ({ ...toSectionRecord(s, i), kind: s.kind })), numbered = recs.filter((r) => r.kind === "s" && r.number);
  const nums = [...new Set([...numbered.map((r) => r.number), ...filled])], heldMax = robustMax(nums.map((n) => parseInt(n, 10) || 0).filter(Boolean));
  const g = findGaps(nums, maxCitedSection(recs.map((r) => r.body ?? ""), heldMax), knownMaxFor(meta.title));
  const wrongStart = numbered.filter((r) => !replaced.has(r.number) && r.body && startsWithOwnNumber(r.number, r.body) === false).map((r) => r.number);
  const collisions = (coll.get(a.actId) ?? []).filter((n) => !replaced.has(String(n)));
  rows.push({ actId: a.actId, title: meta.title, status: meta.act_status, held: nums.length, expected: g.expectedMax, missing: g.missing.length, confident: g.confident.length, uncertain: g.uncertain.length, wrongStart: wrongStart.length, collisions: collisions.length, filled: filled.size, storedConfident: storedBy.get(a.actId) ?? 0, density: g.density });
}
const top = top100.map((t) => rows.find((r) => r.actId === t.actId)).filter(Boolean);
const sum = (arr, f) => arr.reduce((n, r) => n + f(r), 0);
const summarise = (arr) => ({ acts: arr.length, held: sum(arr, (r) => r.held), expected: sum(arr, (r) => r.expected), missing: sum(arr, (r) => r.missing), confident: sum(arr, (r) => r.confident), uncertain: sum(arr, (r) => r.uncertain), actsMissingAny: arr.filter((r) => r.missing).length, under50: arr.filter((r) => r.expected && r.held < 0.5 * r.expected).length, wrongStart: sum(arr, (r) => r.wrongStart), actsWrongStart: arr.filter((r) => r.wrongStart).length, collisions: sum(arr, (r) => r.collisions), actsCollisions: arr.filter((r) => r.collisions).length });
const inForce = rows.filter((r) => r.status === "in_force");
fs.writeFileSync(OUT, JSON.stringify({ all: summarise(rows), inForce: summarise(inForce), top100: summarise(top), top100Rows: top, worstAll: [...inForce].sort((a, b) => b.missing - a.missing).slice(0, 25), confidentActs: rows.filter((r) => r.confident).sort((a, b) => b.confident - a.confident).slice(0, 30), storedConfidentTotal: sum(rows, (r) => r.storedConfident) }, null, 1));
console.log(JSON.stringify({ all: summarise(rows), inForce: summarise(inForce), top100: summarise(top) }, null, 1));
