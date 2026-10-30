#!/usr/bin/env node
// READ-ONLY measurement of extraction marks in stored text (Acts, regulators, Supreme Court judgments). It never writes.
//
//   DATABASE_URL=... REG_DATABASE_URL=... SC_DATABASE_URL=... node scripts/text/measure-marks.mjs [--only acts|reg|sc] [--limit N] [--batch N] [--out report.md] [--json report.json]
//
// Safety: every statement is a fixed SELECT checked by assertReadOnly() and run inside a READ ONLY transaction, so the database refuses a write even if one slipped through.
// Unknown flags (for example --write, --apply, --fix) stop the script. Connection strings are read from the environment and never printed.
// Rules come from src/lib/text/cleanMarks.mjs (the shared cleaner); nothing is cleaned or saved here.
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { assertReadOnly, newTally, measureText, endRow, report } from "./measureLib.mjs";

const FLAGS = new Set(["--only", "--limit", "--batch", "--out", "--json", "--help"]);
const args = process.argv.slice(2), opt = {};
for (let i = 0; i < args.length; i++) {
  if (!FLAGS.has(args[i])) { console.error(`refused: unknown option ${args[i]}. This script only measures; it has no write mode.`); process.exit(2); }
  if (args[i] === "--help") { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 6).map((l) => l.replace(/^\/\/ ?/, "")).join("\n")); process.exit(0); }
  opt[args[i].slice(2)] = args[++i];
}
const ONLY = opt.only, LIMIT = opt.limit ? Number(opt.limit) : Infinity, BATCH = Number(opt.batch ?? 400);
if (ONLY && !["acts", "reg", "sc"].includes(ONLY)) { console.error("--only must be acts, reg or sc"); process.exit(2); }

const { neon } = await import("@neondatabase/serverless");   // loaded after the option check so --help and refusals work without installed packages
const clientFor = (envName) => { const u = process.env[envName]?.trim(); return u ? neon(u) : null; };
async function select(sql, q, params = [], timeoutMs = 60000) {
  assertReadOnly(q);
  const res = await sql.transaction((tx) => [tx.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`), tx.query(q, params)], { readOnly: true });
  return res[1];
}

// ---- sources
async function measureSections(envName, table, label) {
  const t = newTally(label), sql = clientFor(envName) ?? (table === "reg_sections" ? clientFor("DATABASE_URL") : null);
  if (!sql) { t.skipped = `${envName} is not set`; return t; }
  t.total = Number((await select(sql, `SELECT count(*) AS n FROM ${table} WHERE body IS NOT NULL`))[0].n);
  let lastAct = "", lastKey = "";
  while (t.scanned < LIMIT) {
    const rows = await select(sql, `SELECT act_id, section_key, body FROM ${table} WHERE body IS NOT NULL AND (act_id, section_key) > ($1, $2) ORDER BY act_id, section_key LIMIT ${BATCH}`, [lastAct, lastKey]);
    if (!rows.length) break;
    for (const r of rows) {
      if (t.scanned >= LIMIT) break;
      const st = {}; measureText(t, `${r.act_id}/${r.section_key}`, r.body, st); endRow(t, st);
    }
    ({ act_id: lastAct, section_key: lastKey } = rows[rows.length - 1]);
    process.stderr.write(`\r${label}: ${t.scanned}/${t.total}`);
  }
  process.stderr.write("\n");
  return t;
}
async function measureJudgments() {
  const t = newTally("Supreme Court judgments"), sql = clientFor("SC_DATABASE_URL");
  if (!sql) { t.skipped = "SC_DATABASE_URL is not set"; return t; }
  t.total = Number((await select(sql, "SELECT count(*) AS n FROM sc_cases"))[0].n);
  const toBuf = (v) => (typeof v === "string" ? Buffer.from(v.startsWith("\\x") ? v.slice(2) : v, "hex") : Buffer.from(v));
  const SC_BATCH = Math.max(1, Math.min(BATCH, 25));
  let last = "";
  while (t.scanned < LIMIT) {
    const rows = await select(sql, `SELECT case_id, blob FROM sc_cases WHERE case_id > $1 ORDER BY case_id LIMIT ${SC_BATCH}`, [last], 120000);
    if (!rows.length) break;
    for (const r of rows) {
      if (t.scanned >= LIMIT) break;
      const st = {}, chunks = JSON.parse(gunzipSync(toBuf(r.blob)).toString("utf8"));
      for (const c of chunks) if (typeof c.t === "string") measureText(t, r.case_id, c.t, st);
      endRow(t, st);
    }
    last = rows[rows.length - 1].case_id;
    process.stderr.write(`\rjudgments: ${t.scanned}/${t.total}`);
  }
  process.stderr.write("\n");
  return t;
}

const tallies = [];
if (!ONLY || ONLY === "acts") tallies.push(await measureSections("DATABASE_URL", "act_sections", "Act sections"));
if (!ONLY || ONLY === "reg") tallies.push(await measureSections("REG_DATABASE_URL", "reg_sections", "Regulator sections"));
if (!ONLY || ONLY === "sc") tallies.push(await measureJudgments());
const md = report(tallies, { limit: LIMIT });
if (opt.out) fs.writeFileSync(opt.out, md + "\n"); else console.log(md);
if (opt.json) fs.writeFileSync(opt.json, JSON.stringify(tallies.map((t) => ({ ...t, kinds: [...t.kinds.values()].map((k) => ({ ...k, rows: k.rows.size })), brackets: [...t.brackets.values()] })), null, 1));
