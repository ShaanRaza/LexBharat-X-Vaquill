// A re-score can only ADD (an accepted extra filing), never remove: a stored true stays true. Re-scores stored run files with the CURRENT gold rule (scripts/eval/gold.mjs) without calling any model: retrieved and cited are recomputed from the stored sources and answer; the judge's verdict (`correct` as stored
// together with the answer-quality flags) is kept. usage: node scripts/eval/rescore.mjs <run-label>... [--write]   (without --write it only prints; --write adds `rescored` fields next to the old ones, never replaces them)
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { widenGold, satisfies } from "./gold.mjs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }));
const db = neon(env.DATABASE_URL), norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const questions = Object.fromEntries(["questions", "questions-hard", "questions-heldout"].flatMap((f) => JSON.parse(fs.readFileSync(`docs/eval/${f}.json`, "utf8")).questions.map((q) => [q.id, q])));
const FIND = `SELECT s.act_id, s.section_key, s.number, a.title FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`;
const write = process.argv.includes("--write"), labels = process.argv.slice(2).filter((a) => !a.startsWith("--")), cache = new Map();
const goldFor = async (q) => {
  if (cache.has(q.id)) return cache.get(q.id);
  const specs = q.golds ?? [{ act: q.act, anchor: q.anchor }];
  const per = [];
  for (const g of specs) per.push((await Promise.all([g, ...(g.alts ?? [])].map(async (x) => widenGold(db, await db.query(FIND, [x.act.replace(/,.*$/, ""), norm(x.anchor)]), norm(x.anchor))))).flat());
  cache.set(q.id, per); return per;
};
const out = [];
for (const label of labels) {
  const file = `docs/eval/runs/${label}.json`, run = JSON.parse(fs.readFileSync(file, "utf8")); let oldTotal = 0, newTotal = 0; const changed = [];
  for (const r of run.rows) {
    const q = questions[r.id]; const old = r.score ?? 0; oldTotal += old;
    if (!q || q.expect === "notfound" || !r.sources) { newTotal += old; continue; }
    const per = await goldFor(q), matches = per.map((rows) => r.sources.filter((s) => satisfies(s, rows)));
    const retrieved = r.retrieved === true || (matches.length > 0 && matches.every((m) => m.length > 0)), text = r.answerFull ?? r.answer ?? "";
    const cites = (n) => new RegExp(`\\[${n}\\]`).test(text), cited = r.cited === true || (retrieved && matches.length > 0 && matches.every((m) => m.some((s) => cites(s.n))));   // the stored answer is cut at 1,200 characters, so a stored `cited` is kept and the new rule can only add
    const score = (retrieved ? 1 : 0) + (cited ? 1 : 0) + (r.correct ? 1 : 0); newTotal += score;
    if (score !== old) changed.push(`q${r.id}: ${old}→${score}`);
    if (write) { r.rescored = { retrieved, cited, score }; }
  }
  if (write) fs.writeFileSync(file, JSON.stringify(run));
  out.push({ run: label, questions: run.rows.length, old: oldTotal, new: newTotal, changed: changed.join(" ") || "-" });
}
console.table(out);
