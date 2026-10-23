#!/usr/bin/env node
// Picks the 100 most-used Central Acts: rank = number of Supreme Court judgments (distinct case_id) whose text names the Act, summed over the name variants
// the judgments use ("Indian Penal Code, 1860" and "Penal Code, 1860"). Mentions come from scripts/acts/sc-act-mentions.sql (written to a CSV outside the repo);
// they are matched to our Central Acts by title + year. usage: node scripts/acts/rank-central-acts.mjs <mentions.csv> <out.json>
import fs from "node:fs";
import path from "node:path";

const [csvPath, outPath] = [process.argv[2], process.argv[3]];
const idx = JSON.parse(fs.readFileSync(path.resolve("../lexbharat-data/acts-text/_index.json"), "utf8")).filter((a) => a.jurisdiction === "central");
const norm = (t) => { const m = /^(.*?\b[12]\d{3})\b/.exec(t.replace(/\([^)]*\)/g, " ").replace(/\b(?:no\.?\s*)?\d{1,3}\s+of\s+(?=[12]\d{3}\b)/gi, " ")); const s = (m ? m[1] : t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, ""); return s; };
const acts = idx.map((a) => ({ actId: a.actId, title: a.title, key: norm(a.title), sections: a.sections }));
const byKey = new Map(); for (const a of acts) { const arr = byKey.get(a.key) ?? []; arr.push(a); byKey.set(a.key, arr); }
const mentions = fs.readFileSync(csvPath, "utf8").split("\n").slice(1).filter(Boolean).map((l) => { const i = l.lastIndexOf(","); return { k: l.slice(0, i).replace(/"/g, "").trim(), cases: Number(l.slice(i + 1)) }; });
const score = new Map(), variants = new Map();
for (const { k, cases } of mentions) {
  const year = (/\b([12]\d{3})$/.exec(k) ?? [])[1]; if (!year) continue;
  const cands = acts.filter((a) => { const alt = a.key.replace(/ act (\d{4})$/, " $1"); /* "Code of Criminal Procedure Act, 1973" is cited as "Code of Criminal Procedure, 1973" */ return a.key.endsWith(` ${year}`) && (a.key === k || a.key.endsWith(` ${k}`) || k.endsWith(` ${a.key}`) || alt === k || alt.endsWith(` ${k}`)); });
  if (!cands.length) continue;
  // the most specific match: longest title key; ties (a title used by several entries) go to the entry with most sections
  cands.sort((x, y) => y.key.length - x.key.length || y.sections - x.sections);
  const best = cands[0];
  score.set(best.actId, (score.get(best.actId) ?? 0) + cases);
  (variants.get(best.actId) ?? variants.set(best.actId, []).get(best.actId)).push(`${k} (${cases})`);
}
const ranked = [...score.entries()].map(([actId, cases]) => ({ ...acts.find((a) => a.actId === actId), scJudgments: cases, variants: variants.get(actId) })).sort((a, b) => b.scJudgments - a.scJudgments).slice(0, 100);
fs.writeFileSync(outPath, JSON.stringify(ranked, null, 1));
console.log(`matched ${score.size} Central Acts; top 100 written. Top 10:`); for (const r of ranked.slice(0, 10)) console.log(` ${r.scJudgments}  ${r.title.slice(0, 60)}`); console.log(` #100: ${ranked[99]?.scJudgments} ${ranked[99]?.title.slice(0, 50)}`);
