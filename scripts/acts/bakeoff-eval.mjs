#!/usr/bin/env node
// Bake-off step 4: runs the 50 questions (docs/search-eval/questions.json) with keyword only, semantic (each size) and hybrid (keyword + semantic, reciprocal rank fusion).
// A result list is a list of SECTIONS (act_id|section_key, best chunk first); a question is answered at K when a gold section is in the top K.
// Gold = the Central Act sections whose text contains the question's anchor phrase. usage: node scripts/acts/bakeoff-eval.mjs [prefix=emb] [dims=1024,512,256] [out.json]
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { env, voyage, SECTIONS_FILE, TAG } from "./bakeoff-lib.mjs";
import { rrf, dedupe, firstHitRank, hitRates, truncateNormalize } from "../../src/lib/acts/fusion.mjs";

const PREFIX = process.argv[2] ?? "emb", DIMS = (process.argv[3] ?? "1024,512,256").split(",").map(Number), OUT = process.argv[4] ?? "../lexbharat-data/vectors/bakeoff-results.json";
const main = neon(env.DATABASE_URL), vec = neon(env.VECTOR_DATABASE_URL);
const qs = JSON.parse(fs.readFileSync("docs/search-eval/questions.json", "utf8")).questions;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const key = (r) => `${r.act_id}|${r.section_key}`;
// pilot corpus: keyword search is limited to the same sections that were embedded, so the comparison is fair
const corpus = TAG && fs.existsSync(SECTIONS_FILE) ? JSON.parse(fs.readFileSync(SECTIONS_FILE, "utf8")) : null;
const inCorpus = corpus ? ` AND (s.act_id || '|' || s.section_key) = ANY('${"{"}${corpus.map((c) => '"' + c + '"').join(",")}${"}"}'::text[])` : "";

// gold sections (Central Acts only, the corpus of this bake-off)
const gold = [];
for (const q of qs) {
  const r = await main.query(`SELECT s.act_id, s.section_key FROM acts a JOIN act_sections s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`, [q.act.replace(/,.*$/, ""), norm(q.anchor)]);
  gold.push(new Set(r.map(key)));
}
console.log(`gold sections per question: min ${Math.min(...gold.map((g) => g.size))}, max ${Math.max(...gold.map((g) => g.size))}`);

const keywordAnd = async (q) => (await main.query(`SELECT s.act_id, s.section_key FROM act_sections s JOIN acts a ON a.act_id = s.act_id WHERE a.category = 'central' AND s.tsv @@ websearch_to_tsquery('english', $1)${inCorpus} ORDER BY ts_rank_cd(s.tsv, websearch_to_tsquery('english', $1), 32) DESC LIMIT 50`, [q])).map(key);
const stop = new Set("a an and are as at be by can do does for from has have how i if in is it its my of on or the to what when where which who whom why will with would you your".split(" "));
const keywordOr = async (q) => { const words = [...new Set(q.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !stop.has(w)))]; if (!words.length) return []; const tq = words.join(" or "); return (await main.query(`SELECT s.act_id, s.section_key FROM act_sections s JOIN acts a ON a.act_id = s.act_id WHERE a.category = 'central' AND s.tsv @@ websearch_to_tsquery('english', $1)${inCorpus} ORDER BY ts_rank_cd(s.tsv, websearch_to_tsquery('english', $1), 32) DESC LIMIT 50`, [tq])).map(key); };
const semantic = async (table, v) => dedupe((await vec.transaction((tx) => [tx.query("SET LOCAL hnsw.ef_search = 100"), tx.query(`SELECT act_id, section_key FROM ${table} ORDER BY embedding <=> $1::halfvec LIMIT 80`, [`[${v.map((n) => +n.toFixed(7)).join(",")}]`])]))[1].map(key)).slice(0, 50);

const modes = ["keyword AND (today's search)", "keyword OR", ...DIMS.flatMap((d) => [`semantic ${d}`, `hybrid ${d}`])];
const ranks = Object.fromEntries(modes.map((m) => [m, []])), ms = Object.fromEntries(modes.map((m) => [m, []]));
// All 50 questions are embedded in ONE request (gentle on rate limits). The time a search spends on embedding is the median of 5 single-question requests.
const batch = await voyage(qs.map((q) => q.question), "query", 1024); let qTokens = batch.tokens; const embMs = [];
for (let k = 0; k < 5; k++) { const t0 = Date.now(); const one = await voyage([qs[k].question], "query", 1024); qTokens += one.tokens; embMs.push(Date.now() - t0); }
const embTime = [...embMs].sort((a, b) => a - b)[2];
for (const [i, q] of qs.entries()) {
  const e = { vecs: [batch.vecs[i]] };
  let t = Date.now(); const kAnd = await keywordAnd(q.question), tAnd = Date.now() - t;
  t = Date.now(); const kOr = await keywordOr(q.question), tOr = Date.now() - t;
  const rec = (m, list, time) => { ranks[m].push(firstHitRank(list, gold[i])); ms[m].push(time); };
  rec(modes[0], kAnd, tAnd); rec(modes[1], kOr, tOr);
  for (const d of DIMS) {
    const v = d === 1024 ? e.vecs[0] : truncateNormalize(e.vecs[0], d);
    t = Date.now(); const sem = await semantic(`${PREFIX}_${d}`, v), tSem = Date.now() - t;
    rec(`semantic ${d}`, sem, embTime + tSem); rec(`hybrid ${d}`, rrf([sem, kOr]), embTime + tSem + tOr);
  }
  if ((i + 1) % 10 === 0) console.log(`${i + 1}/${qs.length} questions`);
}
const summary = modes.map((m) => ({ mode: m, ...Object.fromEntries(Object.entries(hitRates(ranks[m])).map(([k, v]) => [`top${k}`, +(v * 100).toFixed(1)])), avgMs: Math.round(ms[m].reduce((a, b) => a + b, 0) / ms[m].length), noResult: ranks[m].filter((r) => r === null).length }));
fs.writeFileSync(OUT, JSON.stringify({ summary, queryEmbeddingMedianMs: embTime, queryTokens: qTokens, ranks }, null, 1));
console.log(JSON.stringify({ summary, queryEmbeddingMedianMs: embTime, queryTokens: qTokens }, null, 1));
