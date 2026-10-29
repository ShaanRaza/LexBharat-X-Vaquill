#!/usr/bin/env node
// READ-ONLY: runs the display layer (src/lib/text/clean.mjs) over random REAL sections of Acts and regulator instruments and random Supreme Court judgments, and counts every residue pattern that survives (src/lib/text/residue.mjs).
// The target is zero. usage: node scripts/audit/clean-check.mjs [--n 1500]
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import { cleanPlain } from "../../src/lib/text/clean.mjs";
import { RESIDUE, residue } from "../../src/lib/text/residue.mjs";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const N = Number(process.argv[process.argv.indexOf("--n") + 1]) || 1500;
const HARD = new Set(["picture placeholder", "markdown bold", "HTML tag or entity", "run of lost characters", "literal backslash escape", "control character"]);   // these must be zero; the rest may remain only in text that is itself garbled OCR (under 0.5% of texts)
const tally = (label, texts) => { const c = Object.fromEntries(Object.keys(RESIDUE).map((k) => [k, 0])); let any = 0; const ex = {}; for (const t of texts) { const left = residue(cleanPlain(t)); if (left.length) any++; for (const k of left) { c[k]++; ex[k] ??= cleanPlain(t).match(RESIDUE[k])?.index; } } console.log(`${label}: ${texts.length} texts, ${any} with residue`); for (const [k, v] of Object.entries(c)) if (v) console.log(`   ${String(v).padStart(5)} | ${k}`); const hard = Object.entries(c).filter(([k, v]) => HARD.has(k) && v).length; return hard || any / texts.length > 0.005 ? 1 : 0; };
const main = neon(process.env.DATABASE_URL), reg = neon(process.env.REG_DATABASE_URL || process.env.DATABASE_URL), sc = neon(process.env.SC_DATABASE_URL);
let bad = 0;
bad += tally("Acts", (await main.query(`SELECT body FROM act_sections_v WHERE body IS NOT NULL ORDER BY random() LIMIT $1`, [N])).map((r) => r.body));
bad += tally("Regulators", (await reg.query(`SELECT body FROM reg_sections WHERE body IS NOT NULL ORDER BY random() LIMIT $1`, [N])).map((r) => r.body));
const toBuf = (v) => (typeof v === "string" ? Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") : Buffer.from(v));
bad += tally("Judgments", (await sc.query(`SELECT blob FROM sc_cases ORDER BY random() LIMIT $1`, [Math.min(60, N)])).map((r) => JSON.parse(gunzipSync(toBuf(r.blob)).toString("utf8")).map((c) => c.t).join("\n")));
console.log(bad ? `\n${bad} texts still show junk` : "\nno residue in any sampled text");
process.exit(bad ? 1 : 0);
