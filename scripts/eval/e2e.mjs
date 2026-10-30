#!/usr/bin/env node
// End-to-end scorecard: question -> search -> answer, through the real /api/chat of a LOCAL server, scored against the sections that should be found.
// Expected sections = sections of the question's Act whose text contains the question's `anchor` (computed from Neon). Per question (0-3): the expected section is among the sources shown to the model (1) + the answer cites it with its [n] (1) + a judge (free Gemini, fixed) says the legal answer is right (1).
// Also reported: rank of the expected section, "could not find" replies, check label, seconds. Costs nothing: run the server with free Gemini (see docs/eval/RESULTS.md for the exact command).
// usage: node scripts/eval/e2e.mjs <label> [--base http://localhost:3100] [--only 1,2,51] [--limit N]    -> docs/eval/runs/<label>.json (resumes if the file exists)
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { completeTask } from "../../src/lib/ai/run.mjs";
import { detectNotFound } from "../../src/lib/chat/prompt.mjs";
import { openingHedge } from "../../src/lib/chat/shape.mjs";
import { copyKey } from "../../src/lib/acts/semantic.mjs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
{ // evaluation runs use ONLY an evaluation key (EVAL_GEMINI_API_KEY_2 first, then EVAL_GEMINI_API_KEY), never the live GEMINI_API_KEY: the live site depends on its quota. Never printed.
  const ek = env.EVAL_GEMINI_API_KEY_2 || env.EVAL_GEMINI_API_KEY;
  if (!ek || ek === env.GEMINI_API_KEY) { console.error("No evaluation Gemini key (EVAL_GEMINI_API_KEY_2 or EVAL_GEMINI_API_KEY in .env.local, different from the live key). Refusing to run on the live key."); process.exit(1); }
  env.GEMINI_API_KEY = ek;
}   // the evaluation judge uses its own free key when one is set, so a run does not use up the live app's daily quota (never printed)
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const label = process.argv[2]; if (!label || label.startsWith("--")) { console.log("usage: node scripts/eval/e2e.mjs <label> [--base url] [--only ids] [--limit n]"); process.exit(1); }
const BASE = arg("base", "http://localhost:3100"), PASSWORD = process.env.EVAL_ACCESS_PASSWORD ?? "throwaway-local-test-9";
const only = arg("only", "")?.split(",").filter(Boolean).map(Number), LIMIT = Number(arg("limit", 0));
const OUT = `docs/eval/runs/${label}.json`; fs.mkdirSync("docs/eval/runs", { recursive: true });
const config = JSON.parse(fs.readFileSync("src/config/ai-models.json", "utf8"));
const FREE = { ...config, tasks: { ...config.tasks, chat: { ...config.tasks.chat, model: "gemini:gemini-3.5-flash-lite", fallback: [], firstTokenMs: 0, budgetMs: 0, json: true, maxOutputTokens: 400, timeoutMs: 60000 } } };
const db = neon(env.DATABASE_URL), norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SET = arg("set", "main"), CHECK = process.argv.includes("--check");   // --set hard = docs/eval/questions-hard.json (several expected sections, "expect: notfound", old-law notes)
const SET_FILES = { main: "docs/eval/questions.json", hard: "docs/eval/questions-hard.json", heldout: "docs/eval/questions-heldout.json" };   // heldout = 20 questions written before the Oct 30 answer-quality work, never used for tuning
let qs = JSON.parse(fs.readFileSync(SET_FILES[SET] ?? SET_FILES.main, "utf8")).questions;
if (only?.length) qs = qs.filter((q) => only.includes(q.id)); if (LIMIT) qs = qs.slice(0, LIMIT);
const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : { label, at: new Date().toISOString(), rows: [] };
const jar = new Map();
const keep = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"), i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } };
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
if (!CHECK) {   // --check only reads the database, no server needed
const login = await fetch(`${BASE}/api/access/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }); keep(login);
keep(await fetch(`${BASE}/`, { headers: { cookie: cookie() }, redirect: "manual" }));
const bid = jar.get("lb_bid") ?? [...jar].find(([k]) => /bid/i.test(k))?.[1];
}

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
      if (ev.type === "start") out.chatId = ev.chatId; else if (ev.type === "sources") { out.sources = ev.sources; out.queries = ev.queries ?? []; out.mode = ev.searchMode; out.meaning = ev.meaning ?? null; }
      else if (ev.type === "delta") out.text += ev.text; else if (ev.type === "replace") out.text = ev.text; else if (ev.type === "check") out.check = { label: ev.label }; else if (ev.type === "note") out.notes.push(ev.text); else if (ev.type === "error") out.error = ev.code;
    }
  }
  return out;
}
const judge = async (gs, q, answer) => {
  for (let k = 0; k < 3; k++) {
    try {
      const r = await completeTask("chat", { system: 'You grade an answer about Indian law. Reply with JSON only: {"correct": true|false}. correct = the answer gives the right legal answer to the question according to the reference section(s); when there are several, the answer must cover each part of the question. Extra related provisions do not matter. An answer that says it could not find the answer is not correct.', messages: [{ role: "user", content: `${gs.map((g) => `Reference section (${g.title}, section ${g.number}):\n${g.body.slice(0, 7000 / gs.length)}`).join("\n\n")}\n\nQuestion: ${q}\n\nAnswer:\n${answer}` }] }, { config: FREE, env: { ...env, GEMINI_API_KEY: env.GEMINI_API_KEY }, fetchImpl: fetch });
      return JSON.parse(r.text.replace(/^```json|```$/g, "").trim()).correct === true;
    } catch (e) { await new Promise((res) => setTimeout(res, 8000)); }
  }
  return false;
};
for (const q of qs) {
  if (done.rows.some((x) => x.id === q.id)) continue;
  if (q.skip) { console.log(`q${q.id}: skipped (${q.skip.slice(0, 80)})`); continue; }
  const notfoundQ = q.expect === "notfound", specs = notfoundQ ? [] : q.golds ?? [{ act: q.act, anchor: q.anchor }];
  const perGold = [];   // one entry per expected section: its matching rows in Neon
  const FIND = `SELECT s.act_id, s.section_key, s.number, a.title, s.body FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`;
  // a spec is one expectation; its `alts` are other accepted sections (any one counts), so its rows are the union
  for (const g of specs) perGold.push((await Promise.all([g, ...(g.alts ?? [])].map((x) => db.query(FIND, [x.act.replace(/,.*$/, ""), norm(x.anchor)])))).flat());
  const golds = perGold.flat(), goldKeys = new Set(golds.map((g) => `${g.act_id}|${g.section_key}`));
  if (CHECK) { console.log(`q${q.id}: ${notfoundQ ? "(not-found question)" : perGold.map((r, i) => `${specs[i].act.slice(0, 28)} s${specs[i].section ?? "?"} -> ${r.length} match${r.length === 1 ? "" : "es"}${r[0] ? " [" + r.slice(0, 3).map((x) => x.number).join(",") + "]" : ""}`).join(" | ")}`); continue; }
  const t0 = Date.now(); let a = null;
  for (let k = 0; k < 3; k++) { a = await ask(q.question); if (!a.error) break; console.log(`  q${q.id}: ${a.error}, retrying`); await new Promise((res) => setTimeout(res, 20000)); }
  const secs = (Date.now() - t0) / 1000;
  const matches = perGold.map((rows) => { const keys = new Set(rows.map((g) => `${g.act_id}|${g.section_key}`)); return (a.sources ?? []).map((src, i) => [src, i]).filter(([src]) => keys.has(`${src.actId}|${src.sectionKey}`)); });   // sources that satisfy each expectation
  const ranks = matches.map((m) => (m.length ? m[0][1] : -1));
  const rank = ranks.length && ranks.every((r) => r >= 0) ? Math.max(...ranks) : -1;   // every expectation must be shown; rank = the worst one
  const cites = (n) => new RegExp(`\\[${n}\\]`).test(a.text ?? "");
  const cited = matches.length > 0 && matches.every((m) => m.some(([src]) => cites(src.n)));   // each expectation cited through any one of its accepted sections
  const nf = detectNotFound(a.text ?? "");
  const oldMention = q.oldLaw ? new RegExp(`(previously|earlier|formerly|replaced|old|repealed|IPC)[^.]{0,80}${q.oldLaw}|${q.oldLaw}[^.]{0,80}(previously|earlier|formerly|replaced|repealed)`, "i").test(a.text ?? "") : null;   // answer names the old section as the old law
  const first = (a.text ?? "").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  const openedNotFound = !notfoundQ && /couldn[’']?t find|could not find|cannot find|can[’']?t find/i.test(first) && rank >= 0;   // opened with "I couldn't find..." although the expected section was shown
  const mentions = (q.mustMention ?? []).every((re) => new RegExp(re, "i").test(a.text ?? ""));
  const citedSources = (a.sources ?? []).filter((src) => cites(src.n));
  const forbidden = (q.forbid ?? []).flatMap((f) => citedSources.filter((src) => src.actTitle?.toLowerCase().startsWith(f.act.toLowerCase()) && f.numbers.includes(String(src.number))).map((src) => `${src.actTitle} s${src.number}`));
  const refs = perGold.map((rows, i) => (matches[i][0] ? rows.find((g) => g.act_id === matches[i][0][0].actId && g.section_key === matches[i][0][0].sectionKey) : null) ?? rows[0]).filter(Boolean);
  const judged = notfoundQ ? nf : a.error || !golds.length || nf || !a.text ? false : await judge(refs, q.question, a.text);
  // answer-quality checks that need no judge (class 6): the same citation twice in one sentence, the same section twice among the sources, a hedge before the answer
  const dupCites = (a.text ?? "").split(/\n|(?<=[.;:!?])\s+/).some((seg) => { const m = [...seg.matchAll(/\[(\d{1,2})\]/g)].map((x) => x[1]); return new Set(m).size !== m.length; });
  const seenKeys = new Set(), dupSources = (a.sources ?? []).some((src) => { const k = copyKey(src.actTitle, src.number); if (!k) return false; if (seenKeys.has(k)) return true; seenKeys.add(k); return false; });
  const hedgeFirst = !notfoundQ && !!openingHedge(a.text ?? "");
  const correct = notfoundQ ? nf : judged && !openedNotFound && mentions && !forbidden.length && !dupCites && !hedgeFirst;
  const row = { id: q.id, kind: q.kind ?? null, question: q.question, gold: [...goldKeys], goldFound: notfoundQ || perGold.every((r) => r.length > 0), oldMention, openedNotFound, dupCites, dupSources, hedgeFirst, mentions: q.mustMention ? mentions : null, forbidden: q.forbid ? forbidden : null, retrieved: notfoundQ ? nf : rank >= 0, rank: rank >= 0 && !notfoundQ ? rank + 1 : null, cited: notfoundQ ? nf : cited, correct, notFound: nf, check: a.check?.label ?? null, error: a.error ?? null, secs: +secs.toFixed(1), nSources: a.sources?.length ?? 0, queries: a.queries, meaning: a.meaning ?? null, topSources: (a.sources ?? []).slice(0, 5).map((s) => `${s.actTitle} s${s.number ?? "?"}`), answer: (a.text ?? "").slice(0, 1200), sources: (a.sources ?? []).map((src) => ({ n: src.n, t: src.actTitle, s: src.number ?? null })) };
  row.score = (row.retrieved ? 1 : 0) + (row.cited ? 1 : 0) + (correct ? 1 : 0);   // a question that must be "not found" scores 3 only if the answer says so
  done.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
  console.log(`q${q.id} ${row.score}/3 retrieved=${row.retrieved}${row.rank ? `@${row.rank}` : ""} cited=${cited} correct=${correct}${nf ? " NOTFOUND" : ""}${a.error ? " ERR " + a.error : ""} ${secs.toFixed(0)}s`);
  if (a.chatId) await fetch(`${BASE}/api/chat/${a.chatId}`, { method: "DELETE", headers: { cookie: cookie() } }).catch(() => null);   // remove the evaluation chat (exact id)
}
const rows = done.rows, n = rows.length, sum = (f) => rows.filter(f).length, pct = (x) => `${x}/${n} (${Math.round((100 * x) / Math.max(1, n))}%)`;
if (!CHECK) console.log(`\n${label}: score ${rows.reduce((s, r) => s + r.score, 0)}/${3 * n} | expected section shown to the model ${pct(sum((r) => r.retrieved))} (top 3: ${sum((r) => r.rank && r.rank <= 3)}) | cited ${pct(sum((r) => r.cited))} | judged right ${pct(sum((r) => r.correct))} | "could not find" ${sum((r) => r.notFound)} | errors ${sum((r) => r.error)} | avg ${(rows.reduce((s, r) => s + r.secs, 0) / Math.max(1, n)).toFixed(1)} s`);
if (!CHECK) {
  const kinds = [...new Set(rows.map((r) => r.kind).filter(Boolean))];
  for (const k of kinds) { const rs = rows.filter((r) => r.kind === k); console.log(`  ${k}: ${rs.reduce((s, r) => s + r.score, 0)}/${3 * rs.length}`); }
  const flag = (k) => rows.filter((r) => r[k]).length; console.log(`  answer quality: duplicate citation in a sentence ${flag("dupCites")}, same section twice among the sources ${flag("dupSources")}, hedge before the answer ${flag("hedgeFirst")}, opened with "couldn't find" ${flag("openedNotFound")}, cited a section that does not apply ${rows.filter((r) => r.forbidden?.length).length}`);
  { const m = rows.filter((r) => r.meaning), used = m.reduce((a, r) => a + r.meaning.used, 0), fell = m.reduce((a, r) => a + r.meaning.fellBack, 0), jf = m.filter((r) => r.meaning.judgmentsFailed).length;   // search by meaning vs exact-word fallback (src/lib/acts/meaning.mjs)
    console.log(`  search by meaning: ${used} searches used vectors, ${fell} fell back to exact words${used + fell ? ` (${(100 * fell / (used + fell)).toFixed(1)}%)` : ""}; Supreme Court passages failed on ${jf} question(s); ${m.filter((r) => r.meaning.fellBack).length} of ${m.length} questions had at least one fallback`); }
  const old = rows.filter((r) => r.oldMention !== null); if (old.length) console.log(`  answers that name the old section as the old law: ${old.filter((r) => r.oldMention).length}/${old.length}`);
}
