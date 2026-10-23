#!/usr/bin/env node
// Builds a SMALL corpus for a first bake-off while the Voyage account is limited to 3 requests and 10K tokens per minute (no payment method):
// every section that answers one of the 50 questions plus N random other Central sections as distractors. usage: node scripts/acts/bakeoff-pilot-corpus.mjs [distractors=700]
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { env } from "./bakeoff-lib.mjs";

const N = Number(process.argv[2] ?? 700);
const main = neon(env.DATABASE_URL);
const qs = JSON.parse(fs.readFileSync("docs/search-eval/questions.json", "utf8")).questions;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const gold = new Set();
for (const q of qs) for (const r of await main.query(`SELECT s.act_id, s.section_key FROM acts a JOIN act_sections s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`, [q.act.replace(/,.*$/, ""), norm(q.anchor)])) gold.add(`${r.act_id}|${r.section_key}`);
const all = fs.readFileSync("../lexbharat-data/vectors/central-chunks.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const bySection = new Map(); for (const c of all) { const k = `${c.actId}|${c.sectionKey}`; (bySection.get(k) ?? bySection.set(k, []).get(k)).push(c); }
let seed = 20261023; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const others = [...bySection.keys()].filter((k) => !gold.has(k)); for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
const chosen = [...gold].filter((k) => bySection.has(k)).concat(others.slice(0, N));
const chunks = []; for (const k of chosen) for (const c of bySection.get(k)) chunks.push({ ...c, i: chunks.length });
fs.writeFileSync("../lexbharat-data/vectors/central-chunks-pilot.jsonl", chunks.map((c) => JSON.stringify(c)).join("\n") + "\n");
fs.writeFileSync("../lexbharat-data/vectors/central-sections-pilot.json", JSON.stringify(chosen));
const chars = chunks.reduce((n, c) => n + c.text.length, 0);
console.log(JSON.stringify({ goldSections: gold.size, distractorSections: Math.min(N, others.length), chunks: chunks.length, chars, estTokens: Math.round(chars / 4.36) }));
