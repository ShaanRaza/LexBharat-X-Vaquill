#!/usr/bin/env node
// Answer scorecard: runs the chat prompt (src/lib/chat/prompt.mjs) on real statute sections for a set of models and compares score, speed and cost.
// Sources are given directly (the gold section + 3 other Acts' sections, shuffled) so retrieval and the free Voyage limit are not part of the test; 4 questions get NO gold section and must answer "not found".
// Score per answerable question (0-3): cites the gold source [n] (1) + names the section number and Act (1) + a judge model (fixed, same for every run) says the answer gives the right legal answer according to the gold section (1; extra related provisions are allowed by the prompt, so they are not penalised).
// Unanswerable: 1 if the answer says it could not find it (detectNotFound), else 0. Cost = tokens x the model's list price (OpenRouter prices; Gemini free tier is shown at its list price, you pay 0).
// usage: node scripts/ai/scorecard.mjs [--n 12] [--models spec1,spec2] [--budget 0.25] [--out file.json]. Stops before the cost passes --budget (USD). Never prints a key.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { streamTask } from "../../src/lib/ai/run.mjs";
import { buildChatPrompt, detectNotFound } from "../../src/lib/chat/prompt.mjs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg("n", 12)), BUDGET = Number(arg("budget", 0.25)), OUT = arg("out", null);
const MODELS = arg("models", "gemini:gemini-3.5-flash-lite").split(",");
const SONNET_N = Number(arg("sonnet-n", 6));
const config = JSON.parse(fs.readFileSync("src/config/ai-models.json", "utf8"));
const JUDGE = arg("judge", "gemini:gemini-3.5-flash-lite");   // evaluations use the free Gemini plan only: a paid route (openrouter:/openai:) must be asked for with --allow-paid
if ([...MODELS, JUDGE].some((m) => /^(openrouter|openai|anthropic):/.test(m)) && !process.argv.includes("--allow-paid")) { console.log("A paid route (openrouter:, openai:, anthropic:) was asked for. Evaluations stay on free Gemini; add --allow-paid only if you have decided to spend credit."); process.exit(1); }
// $ per 1M tokens (OpenRouter list, read 2026-10-29)
const PRICE = { "gemini:gemini-3.5-flash-lite": [0.3, 2.5], "openrouter:anthropic/claude-haiku-5.5": [0.1, 0.5], "openrouter:openai/gpt-4.1-mini": [0.4, 1.6], "openrouter:google/gemini-3.5-flash-lite": [0.3, 2.5], "openrouter:anthropic/claude-sonnet-5.5": [2, 10], "openrouter:deepseek/deepseek-v4-flash": [0.091, 0.182] };
let spent = 0;
const db = neon(env.DATABASE_URL), norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const qs = JSON.parse(fs.readFileSync("docs/search-eval/questions.json", "utf8")).questions;
// gold section per question (first Central match), with act title
const rows = [];
for (const q of qs) {
  const r = await db.query(`SELECT a.act_id, a.title, a.year, s.section_key, s.number, s.heading, s.body FROM acts a JOIN act_sections s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%' ORDER BY length(s.body) LIMIT 1`, [q.act.replace(/,.*$/, ""), norm(q.anchor)]);
  if (r[0]) rows.push({ q, gold: r[0] });
}
const src = (g, n) => ({ n, actTitle: g.title, year: g.year, inForce: true, number: g.number ?? g.section_key, heading: g.heading, text: g.body });
// deterministic pick: spread over Acts
const seen = new Map(), picked = [];
for (const r of rows) { const c = seen.get(r.q.act) ?? 0; if (c < 2) { seen.set(r.q.act, c + 1); picked.push(r); } }
const answerable = picked.slice(0, N), unanswerable = picked.slice(N, N + 4);
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const items = [...answerable.map((r) => ({ ...r, kind: "answer" })), ...unanswerable.map((r) => ({ ...r, kind: "notfound" }))].map((it) => {
  const others = rows.filter((x) => x.q.act !== it.q.act && x.gold.act_id !== it.gold.act_id).sort(() => rnd() - 0.5).slice(0, it.kind === "answer" ? 3 : 4).map((x) => x.gold);
  const list = it.kind === "answer" ? [it.gold, ...others] : others;
  list.sort(() => rnd() - 0.5);
  const sources = list.map((g, i) => src(g, i + 1)), goldN = it.kind === "answer" ? list.indexOf(it.gold) + 1 : null;
  return { ...it, sources, goldN };
});
const cost = (m, u) => { const p = PRICE[m] ?? [0, 0]; return (u.inputTokens * p[0] + u.outputTokens * p[1]) / 1e6; };
async function run(model, system, messages, opts = {}) {
  const cfg = { ...config, tasks: { ...config.tasks, chat: { ...config.tasks.chat, model, fallback: [], firstTokenMs: 0, budgetMs: 0, timeoutMs: 90000, thinking: "off", maxOutputTokens: opts.max ?? 1200, ...(opts.json ? { json: true } : {}) } } };
  const t0 = Date.now(); let ttft = null, text = "", usage = { inputTokens: 0, outputTokens: 0 };
  for await (const ev of streamTask("chat", { system, messages }, { config: cfg, env, fetchImpl: fetch })) { if (ev.type === "text") { ttft ??= Date.now() - t0; text += ev.text; } else if (ev.type === "done") usage = ev.usage; }
  const c = cost(model, usage); spent += c; return { text, usage, ttft, ms: Date.now() - t0, cost: c };
}
const judge = async (it, answer) => {
  const g = it.gold, r = await run(JUDGE, 'You grade an answer about Indian law. Reply with JSON only: {"correct": true|false, "unsupported": true|false}. correct = the answer gives the right legal answer to the question according to the reference section. unsupported = the answer states law that is not in the reference section.', [{ role: "user", content: `Reference section (${g.title}, section ${g.number ?? g.section_key}):\n${g.body.slice(0, 3500)}\n\nQuestion: ${it.q.question}\n\nAnswer:\n${answer}` }], { json: true, max: 800 });
  if (process.env.DEBUG_JUDGE) console.log(`  judge q${it.q.id}: ${r.text.slice(0, 160)} | answer: ${answer.slice(0, 160).replace(/\n/g, ' ')}`);
  try { return JSON.parse(r.text.replace(/^```json|```$/g, "").trim()); } catch { return { correct: false, unsupported: true, bad: true }; }
};
const results = [];
for (const model of MODELS) {
  const list = /sonnet/.test(model) ? items.slice(0, SONNET_N).concat(items.filter((i) => i.kind === "notfound").slice(0, 1)) : items;
  const out = { model, n: 0, score: 0, max: 0, answerable: 0, notFoundOk: 0, notFoundN: 0, errors: 0, ms: [], ttft: [], cost: 0, cites: 0, names: 0, judged: 0, right: 0 };
  for (const it of list) {
    if (spent > BUDGET) { console.log(`budget $${BUDGET} reached, stopping`); break; }
    const { system, messages } = buildChatPrompt({ question: it.q.question, sources: it.sources });
    let r; try { r = await run(model, system, messages); } catch (e) { out.errors++; console.log(`  ${model} q${it.q.id}: error ${e?.kind ?? e?.name}`); continue; }
    out.n++; out.ms.push(r.ms); out.ttft.push(r.ttft ?? r.ms); out.cost += r.cost;
    if (it.kind === "notfound") { out.notFoundN++; out.max += 1; if (detectNotFound(r.text)) { out.notFoundOk++; out.score += 1; } continue; }
    out.answerable++; out.max += 3;
    const cites = new RegExp(`\\[${it.goldN}\\]`).test(r.text), names = new RegExp(`section\\s+${String(it.gold.number ?? it.gold.section_key).replace(/\W/g, "\\W?")}\\b`, "i").test(r.text) && r.text.toLowerCase().includes(it.gold.title.replace(/^the\s+/i, "").split(",")[0].toLowerCase().slice(0, 12));
    const j = await judge(it, r.text); out.judged++;
    out.cites += cites; out.names += names; out.right += j.correct ? 1 : 0; out.score += cites + names + (j.correct ? 1 : 0);
  }
  results.push(out); console.log(`${model}: score ${out.score}/${out.max}, spent so far $${spent.toFixed(4)}`);
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log("\nmodel | score | cites gold | names section | judged right | not-found ok | errors | first text (s) | total (s) | cost/question (USD, list price)");
for (const o of results) console.log([o.model, `${o.score}/${o.max}`, `${o.cites}/${o.answerable}`, `${o.names}/${o.answerable}`, `${o.right}/${o.answerable}`, `${o.notFoundOk}/${o.notFoundN}`, o.errors, (avg(o.ttft) / 1000).toFixed(1), (avg(o.ms) / 1000).toFixed(1), (o.cost / Math.max(1, o.n)).toFixed(5)].join(" | "));
console.log(`total spent on OpenRouter-priced calls (incl. judge): $${spent.toFixed(4)}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), items: items.map((i) => ({ id: i.q.id, kind: i.kind })), results, spent }, null, 1));
