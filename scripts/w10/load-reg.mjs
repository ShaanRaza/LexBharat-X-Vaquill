#!/usr/bin/env node
// W10 item 7: loads regulator instrument text (from ../lexbharat-data/reg-text, built by scripts/acts/export-reg-text.sh) into reg_acts / reg_sections.
// Target database: REG_DATABASE_URL (its own free Neon project) when set, otherwise DATABASE_URL (the main one: small tests only; the stop line is 900 MB).
// usage: node scripts/w10/load-reg.mjs [--departments=dgft,cbic,...] [--apply]     (default: dry run that prints sizes). Garbled sections keep their row but no text, as for Acts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { env, redact } from "../acts/bakeoff-lib.mjs";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";

const args = process.argv.slice(2), APPLY = args.includes("--apply"), DEPTS = (args.find((a) => a.startsWith("--departments=")) ?? "").slice(14).split(",").filter(Boolean);
const URLVAR = env.REG_DATABASE_URL ? "REG_DATABASE_URL" : "DATABASE_URL", DIR = path.resolve("../lexbharat-data/reg-text");
const meta = new Map(JSON.parse(fs.readFileSync("src/data/acts/acts.regulations.json", "utf8")).map((r) => [r.actId, r]));
const u = new URL(env[URLVAR]);
const pgEnv = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1), PGSSLMODE: "require", PGCONNECT_TIMEOUT: "30" };
const psql = (a) => { try { return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", ...a], { env: pgEnv, maxBuffer: 1 << 28 }).toString(); } catch (e) { throw new Error(redact(e.stderr?.toString() ?? e.message)); } };
const q = (v) => (v === null || v === undefined ? "" : `"${String(v).replace(/"/g, '""')}"`);
const arr = (a) => q(`{${a.map((x) => `"${x}"`).join(",")}}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reg-")), A = fs.createWriteStream(path.join(tmp, "acts.csv")), S = fs.createWriteStream(path.join(tmp, "secs.csv"));
const tally = { acts: 0, sections: 0, withText: 0, garbled: 0, bytes: 0, byDept: {} };
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json.gz")).sort()) {
  const d = JSON.parse(gunzipSync(fs.readFileSync(path.join(DIR, f)))), m = meta.get(d.actId);
  if (!m || (DEPTS.length && !DEPTS.includes(m.department))) continue;
  const recs = d.sections.map((s, i) => toSectionRecord(s, i));
  A.write([q(d.actId), q(m.title), q(m.department), m.year ?? "", q(m.actStatus), q(d.sourceUrl), recs.length].join(",") + "\n");
  tally.acts++; (tally.byDept[m.department] ??= { acts: 0, sections: 0, mb: 0 }).acts++;
  for (const r of recs) {
    S.write([q(d.actId), q(r.sectionKey), r.ord, q(r.number), q(r.heading), q(r.chapter), q(r.status), arr(r.flags), r.chunkCount, q(r.body)].join(",") + "\n");
    tally.sections++; tally.byDept[m.department].sections++;
    if (r.body === null) tally.garbled++; else { tally.withText++; tally.bytes += Buffer.byteLength(r.body); tally.byDept[m.department].mb += Buffer.byteLength(r.body) / 1e6; }
  }
}
A.end(); S.end(); await Promise.all([new Promise((r) => A.on("finish", r)), new Promise((r) => S.on("finish", r))]);
console.log(JSON.stringify({ ...tally, mb: +(tally.bytes / 1e6).toFixed(1), target: URLVAR }));
if (!APPLY) { fs.rmSync(tmp, { recursive: true }); process.exit(0); }
const before = Number(psql(["-c", "select pg_database_size(current_database())/1048576"]).trim());
if (before > 900) { console.error(`The target database is ${before} MB, over the 900 MB stop line. Nothing was loaded.`); process.exit(1); }
psql(["-f", "scripts/w10/reg-schema.sql"]);
const ids = [...meta.values()].filter((m) => !DEPTS.length || DEPTS.includes(m.department)).map((m) => m.actId);
psql(["-c", DEPTS.length ? `DELETE FROM reg_sections WHERE act_id IN (SELECT act_id FROM reg_acts WHERE department = ANY('{${DEPTS.join(",")}}')); DELETE FROM reg_acts WHERE department = ANY('{${DEPTS.join(",")}}')` : "TRUNCATE reg_sections, reg_acts CASCADE"]);
psql(["-c", `\\copy reg_acts (act_id,title,department,year,act_status,source_url,section_count) FROM '${tmp}/acts.csv' WITH (FORMAT csv)`]);
psql(["-c", `\\copy reg_sections (act_id,section_key,ord,number,heading,chapter,status,flags,chunk_count,body) FROM '${tmp}/secs.csv' WITH (FORMAT csv)`]);
psql(["-c", "ANALYZE reg_acts; ANALYZE reg_sections"]);
fs.rmSync(tmp, { recursive: true });
console.log(psql(["-c", "select 'reg_acts', count(*)::text from reg_acts union all select 'reg_sections', count(*)::text from reg_sections union all select 'database', pg_size_pretty(pg_database_size(current_database())) union all select 'reg_sections heap+toast', pg_size_pretty(pg_table_size('reg_sections')) union all select 'fts index', pg_size_pretty(pg_relation_size('reg_sections_fts'))"]).trim());
