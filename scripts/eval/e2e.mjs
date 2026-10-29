#!/usr/bin/env node
// End-to-end scorecard: question -> search -> answer, through the real /api/chat of a LOCAL server, scored against the sections that should be found.
// Expected sections = sections of the question's Act whose text contains the question's `anchor` (computed from Neon). Per question (0-3): the expected section is among the sources shown to the model (1) + the answer cites it with its [n] (1) + a judge (free Gemini, fixed) says the legal answer is right (1).
// Also reported: rank of the expected section, "could not find" replies, check label, seconds. Costs nothing: run the server with free Gemini (see docs/eval/RESULTS.md for the exact command).
// usage: node scripts/eval/e2e.mjs <label> [--base http://localhost:3100] [--only 1,2,51] [--limit N]    -> docs/eval/runs/<label>.json (resumes if the file exists)
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { completeTask } from "../../src/lib/ai/run.mjs";
import { detectNotFound } from "../../src/lib/chat/prompt.mjs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const label = process.argv[2]; if (!label || label.startsWith("--")) { console.log("usage: node scripts/eval/e2e.mjs <label> [--base url] [--only ids] [--limit n]"); process.exit(1); }
const BASE = arg("base", "http://localhost:3100"), PASSWORD = process.env.EVAL_ACCESS_PASSWORD ?? "throwaway-local-test-9";
const only = arg("only", "")?.split(",").filter(Boolean).map(Number), LIMIT = Number(arg("limit", 0));
const OUT = `docs/eval/runs/${label}.json`; fs.mkdirSync("docs/eval/runs", { recursive: true });
const config = JSON.parse(fs.readFileSync("src/config/ai-models.json", "utf8"));
const FREE = { ...config, tasks: { ...config.tasks, chat: { ...config.tasks.chat, model: "gemini:gemini-3.5-flash-lite", fallback: [], firstTokenMs: 0, budgetMs: 0, json: true, maxOutputTokens: 400, timeoutMs: 60000 } } };
const db = neon(env.DATABASE_URL), norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
let qs = JSON.parse(fs.readFileSync("docs/eval/questions.json", "utf8")).questions;
if (only?.length) qs = qs.filter((q) => only.includes(q.id)); if (LIMIT) qs = qs.slice(0, LIMIT);
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { label, at: new Date().toISOString(), rows: [] };
const jar = new Map();
const keep = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"), i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const login = await fetch(`${BASE}/api/access/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }); keep(login);
keep(await fetch(`${BASE}/`, { headers: { cookie: cookie() }, redirect: "manual" }));
const bid = jar.get("lb_bid") ?? [...jar].find(([k]) => /bid/i.test(k))?.[1];

async function ask(message) {
  const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json", cookie: cookie() }, body: JSON.stringify({ message }) });
  if (!r.ok) return { error: `http ${r.status}` };
  let buf = "", out = { text: "", sources: [], check: null, chatId: null, queries: [], error: null, notes: [] };
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!line) continue;
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev.type === "start") out.chatId = ev.chatId; else if (ev.type === "sources") { out.sources = ev.sources; out.queries = ev.queries ?? []; out.mode = ev.searchMode; }
      else if (ev.type === "delta") out.text += ev.text; else if (ev.type === "replace") out.text = ev.text; else if (ev.type === "check") out.check = { label: ev.label }; else if (ev.type === "note") out.notes.push(ev.text); else if (ev.type === "error") out.error = ev.code;
    }
  }
  return out;
}
const judge = async (g, q, answer) => {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await completeTask("chat", { system: 'You grade an answer about Indian law. Reply with JSON only: {"correct": true|false}. correct = the answer gives the right legal answer to the question according to the reference section. Extra related provisions do not matter. An answer that says it could not find the answer is not correct.', messages: [{ role: "user", content: `Reference section (${g.title}, section ${g.number}):\n${g.body.slice(0, 7000)}\n\nQuestion: ${q}\n\nAnswer:\n${answer}` }] }, { config: FREE, env: { ...env, GEMINI_API_KEY: env.GEMINI_API_KEY }, fetchImpl: fetch });
      return JSON.parse(r.text.replace(/^```json|```$/g, "").trim()).correct === true;
    } catch (e) { await new Promise((res) => setTimeout(res, 8000)); }
  }
  return false;
};
for (const q of qs) {
  if (done.rows.some((x) => x.id === q.id)) continue;
  const golds = await db.query(`SELECT s.act_id, s.section_key, s.number, a.title, s.body FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`, [q.act.replace(/,.*$/, ""), norm(q.anchor)]);
  const goldKeys = new Set(golds.map((g) => `${g.act_id}|${g.section_key}`));
  const t0 = Date.now(); let a = null;
  for (let k = 0; k < 3; k++) { a = await ask(q.question); if (!a.error) break; console.log(`  q${q.id}: ${a.error}, retrying`); await new Promise((res) => setTimeout(res, 20000)); }
  const secs = (Date.now() - t0) / 1000;
  const rank = a.sources?.findIndex((s) => goldKeys.has(`${s.actId}|${s.sectionKey}`)) ?? -1;
  const goldN = rank >= 0 ? a.sources[rank].n : null;
  const cited = goldN !== null && new RegExp(`\\[${goldN}\\]`).test(a.text ?? "");
  const nf = detectNotFound(a.text ?? "");
  const correct = a.error || !golds.length || nf || !a.text ? false : await judge(golds[0], q.question, a.text);
  const row = { id: q.id, question: q.question, gold: [...goldKeys], goldFound: golds.length > 0, retrieved: rank >= 0, rank: rank >= 0 ? rank + 1 : null, cited, correct, notFound: nf, check: a.check?.label ?? null, error: a.error ?? null, secs: +secs.toFixed(1), nSources: a.sources?.length ?? 0, queries: a.queries, topSources: (a.sources ?? []).slice(0, 5).map((s) => `${s.actTitle} s${s.number ?? "?"}`), answer: (a.text ?? "").slice(0, 1200) };
  row.score = (row.retrieved ? 1 : 0) + (cited ? 1 : 0) + (correct ? 1 : 0);
  done.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  console.log(`q${q.id} ${row.score}/3 retrieved=${row.retrieved}${row.rank ? `@${row.rank}` : ""} cited=${cited} correct=${correct}${nf ? " NOTFOUND" : ""}${a.error ? " ERR " + a.error : ""} ${secs.toFixed(0)}s`);
  if (a.chatId) await fetch(`${BASE}/api/chat/${a.chatId}`, { method: "DELETE", headers: { cookie: cookie() } }).catch(() => null);   // remove the evaluation chat (exact id)
}
const rows = done.rows, n = rows.length, sum = (f) => rows.filter(f).length, pct = (x) => `${x}/${n} (${Math.round((100 * x) / Math.max(1, n))}%)`;
console.log(`\n${label}: score ${rows.reduce((s, r) => s + r.score, 0)}/${3 * n} | expected section shown to the model ${pct(sum((r) => r.retrieved))} (top 3: ${sum((r) => r.rank && r.rank <= 3)}) | cited ${pct(sum((r) => r.cited))} | judged right ${pct(sum((r) => r.correct))} | "could not find" ${sum((r) => r.notFound)} | errors ${sum((r) => r.error)} | avg ${(rows.reduce((s, r) => s + r.secs, 0) / Math.max(1, n)).toFixed(1)} s`);
