#!/usr/bin/env node
// W10 item 10: Supreme Court full text (English) from the dataset Parquet into two free Neon projects:
//   SC_DATABASE_URL          sc_cases   one row per case: gzip JSON of the ordered chunks [{i, cs, ps, t}] (i = chunk_index, cs = char_start, ps = page_start, t = text); about 0.4 GB for 35,596 cases
//   SC_KEYWORD_DATABASE_URL  sc_kw      one row per case: the word index of the whole judgment: distinct English word stems (letters/digits, 2-30 characters) that occur at least TWICE in it, no positions (a word used once in a judgment is not indexed: that keeps the index inside the free 1 GB) + GIN index; phrases and ranking are checked against the blob in the app
// Header lines ("Case: ... Section: ...") and the dataset's [SECTION]/[TITLE] markers are removed from the text. Stops (exit 1) if a target database passes 900 MB.
// usage: node scripts/w10/load-sc.mjs [--limit=N cases] [--only=cases|kw] [--apply]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { gzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { env, redact } from "../acts/bakeoff-lib.mjs";

const args = process.argv.slice(2), APPLY = args.includes("--apply"), LIMIT = Number((args.find((a) => a.startsWith("--limit=")) ?? "").slice(8)) || 0, ONLY = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const PQ = "/Volumes/LAWSSD/open-india-law/in_supreme-court_judgments.parquet", MAXMB = 900;
const pg = (name) => { const u = new URL(env[name].replace(/^["']|["']$/g, "")); const e = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1), PGSSLMODE: "require", PGCONNECT_TIMEOUT: "30" };
  return (a, input) => { try { return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", "-q", ...a], { env: e, maxBuffer: 1 << 28, input }).toString(); } catch (er) { throw new Error(redact(er.stderr?.toString() ?? er.message)); } }; };
const text = pg("SC_DATABASE_URL"), kw = pg("SC_KEYWORD_DATABASE_URL");
const mb = (p) => Number(p(["-c", "select pg_database_size(current_database())/1048576"]).trim());

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sc-")), nd = path.join(tmp, "chunks.ndjson");
execFileSync("duckdb", ["-c", `COPY (SELECT case_id, chunk_index AS i, char_start AS cs, page_start AS ps, trim(regexp_replace(regexp_replace(text, '^Case:[^\\n]*\\n+Section:[^\\n]*\\n*', ''), '\\[(SECTION|TITLE)\\]\\s*(#+)?\\s*', ' ', 'g')) AS t FROM read_parquet('${PQ}') WHERE language_code = 'en' ORDER BY case_id, char_start) TO '${nd}' (FORMAT JSON, ARRAY false)`], { maxBuffer: 1 << 26 });
console.error("exported chunks to a temp file");

if (APPLY) {
  if (!LIMIT) { try { if (ONLY !== "kw") text(["-c", "TRUNCATE sc_cases"]); if (ONLY !== "cases") kw(["-c", "TRUNCATE sc_kw"]); } catch { /* tables not created yet */ } }
  if (ONLY !== "kw") text(["-c", "CREATE TABLE IF NOT EXISTS sc_cases (case_id text PRIMARY KEY, n_chunks int NOT NULL, chars int NOT NULL, mixed boolean NOT NULL DEFAULT false, blob bytea NOT NULL)"]);
  if (ONLY !== "cases") kw(["-c", "CREATE TABLE IF NOT EXISTS sc_kw (case_id text PRIMARY KEY, tsv tsvector NOT NULL); CREATE TABLE IF NOT EXISTS sc_kw_stage (case_id text, body text); DO $$ BEGIN CREATE AGGREGATE tsv_concat(tsvector) (SFUNC = tsvector_concat, STYPE = tsvector); EXCEPTION WHEN duplicate_function THEN NULL; END $$"]);
}
const INDIC = /[ऀ-෿]/;
const csvq = (v) => `"${String(v).replace(/"/g, '""')}"`;
let cur = null, rows = [], nCases = 0, nChunks = 0, bytes = 0, batchCases = [], batchStage = [];
const BATCH = Number(process.env.SC_BATCH ?? 300);
function flushBatch() {
  if (!batchCases.length) return;
  if (APPLY) {
    if (ONLY !== "kw") { const f = path.join(tmp, "cases.csv"); fs.writeFileSync(f, batchCases.map((c) => [csvq(c.id), c.n, c.chars, c.mixed, csvq("\\x" + c.blob.toString("hex"))].join(",")).join("\n") + "\n"); text(["-c", `\\copy sc_cases (case_id,n_chunks,chars,mixed,blob) FROM '${f}' WITH (FORMAT csv)`]); }
    if (ONLY !== "cases") {
      const f = path.join(tmp, "stage.csv"); fs.writeFileSync(f, batchStage.map((s) => `${csvq(s.id)},${csvq(s.body)}`).join("\n") + "\n");
      kw(["-c", `TRUNCATE sc_kw_stage`, "-c", `\\copy sc_kw_stage FROM '${f}' WITH (FORMAT csv)`, "-c", `INSERT INTO sc_kw SELECT case_id, array_to_tsvector(array_agg(lexeme)) FROM (SELECT case_id, (u).lexeme AS lexeme, sum(coalesce(array_length((u).positions, 1), 1)) AS n FROM (SELECT case_id, unnest(to_tsvector('english', left(body, 900000))) AS u FROM sc_kw_stage) x GROUP BY 1, 2) y WHERE n >= 2 AND lexeme ~ '^[a-z0-9]{2,30}$' GROUP BY case_id ON CONFLICT (case_id) DO UPDATE SET tsv = EXCLUDED.tsv`]);
    }
    if (nCases % 3000 < BATCH) { const a = ONLY !== "kw" ? mb(text) : 0, b = ONLY !== "cases" ? mb(kw) : 0; console.error(`${nCases} cases, ${nChunks} chunks, text db ${a} MB, keyword db ${b} MB`); if (a > MAXMB || b > MAXMB) { console.error("STOP: a database is over 900 MB"); process.exit(1); } }
  }
  batchCases = []; batchStage = [];
}
function endCase() {
  if (!cur) return;
  const chunks = rows.map((r) => ({ i: r.i, cs: r.cs, ps: r.ps, t: r.t })), json = JSON.stringify(chunks), blob = gzipSync(json, { level: 9 }), body = rows.map((r) => r.t).join("\n\n");
  batchCases.push({ id: cur, n: chunks.length, chars: body.length, mixed: rows.some((r) => INDIC.test(r.t)), blob }); batchStage.push({ id: cur, body });
  bytes += blob.length; nCases++; nChunks += chunks.length; rows = [];
  if (batchCases.length >= BATCH) flushBatch();
}
for await (const line of readline.createInterface({ input: fs.createReadStream(nd), crlfDelay: Infinity })) {
  if (!line) continue;
  const r = JSON.parse(line);
  if (r.case_id !== cur) { endCase(); if (LIMIT && nCases >= LIMIT) { cur = null; break; } cur = r.case_id; }
  rows.push(r);
}
if (cur) endCase();
flushBatch();
if (APPLY) {
  if (ONLY !== "cases") kw(["-c", "CREATE INDEX IF NOT EXISTS sc_kw_gin ON sc_kw USING GIN (tsv); DROP TABLE IF EXISTS sc_kw_stage; ANALYZE sc_kw"]);
  console.log(JSON.stringify({ cases: nCases, chunks: nChunks, blobMB: +(bytes / 1e6).toFixed(1) }));
  if (ONLY !== "kw") console.log("text db", text(["-c", "select pg_size_pretty(pg_database_size(current_database()))"]).trim());
  if (ONLY !== "cases") console.log("keyword db", kw(["-c", "select pg_size_pretty(pg_database_size(current_database())), pg_size_pretty(pg_relation_size('sc_kw_gin')), pg_size_pretty(pg_table_size('sc_kw'))"]).trim());
} else console.log(JSON.stringify({ dryRun: true, cases: nCases, chunks: nChunks, blobMB: +(bytes / 1e6).toFixed(1) }));
fs.rmSync(tmp, { recursive: true });
