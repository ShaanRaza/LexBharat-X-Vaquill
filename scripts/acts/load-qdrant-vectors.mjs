#!/usr/bin/env node
// Loads the vectors exported by export-qdrant-vectors.mjs into the VECTOR database as halfvec(DIM) + HNSW (cosine), keyed by chunk id and (act_id, section_key).
// Truncates to DIM and renormalises when the exported file has more dimensions (Matryoshka; identical to asking Voyage for DIM dimensions). Unmatched points (no shown Neon section) are skipped.
// VECTOR_URL_VAR=<name of the .env.local variable that holds the target connection string> (default VECTOR_DATABASE_URL; W10: VECTOR_DATABASE_URL_REGULATORY for the regulators).
// usage: node scripts/acts/load-qdrant-vectors.mjs [scope=central] [dim=256] [table=<scope>_emb_<dim>]      (scope: central | state; reads ../lexbharat-data/vectors/<scope>-qdrant-*)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgEnv, redact } from "./bakeoff-lib.mjs";
import { truncateNormalize } from "../../src/lib/acts/fusion.mjs";

const SCOPE = process.argv[2] ?? "central", DIM = Number(process.argv[3] ?? 256), T = process.argv[4] ?? `${SCOPE}_emb_${DIM}`, V = "../lexbharat-data/vectors";
const metaRows = fs.readFileSync(`${V}/${SCOPE}-qdrant-chunks.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const fFile = fs.readdirSync(V).find((f) => f.startsWith(`${SCOPE}-qdrant-`) && f.endsWith(".f32"));
const buf = fs.readFileSync(`${V}/${fFile}`), D0 = Math.round(buf.length / metaRows.length / 4);
if (buf.length !== metaRows.length * D0 * 4 || D0 < DIM) throw new Error("vector file and chunk list differ in length, or the file has fewer dimensions than requested");
const psql = (args) => { try { return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", ...args], { env: pgEnv(process.env.VECTOR_URL_VAR ?? "VECTOR_DATABASE_URL"), maxBuffer: 1 << 28 }).toString(); } catch (e) { throw new Error(redact(e.stderr?.toString() ?? e.message)); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vec-")), csv = path.join(tmp, "v.csv"), out = fs.createWriteStream(csv);
let rows = 0, skipped = 0;
metaRows.forEach((m, i) => {
  if (!m.matched) { skipped++; return; }
  const x = truncateNormalize(new Float32Array(buf.buffer, buf.byteOffset + i * D0 * 4, D0), DIM);
  out.write(`${m.chunkId},${m.actId},${m.sectionKey},"[${x.map((n) => +n.toFixed(7)).join(",")}]"\n`); rows++;
});
out.end(); await new Promise((r) => out.on("finish", r));
psql(["-c", `DROP TABLE IF EXISTS ${T}; CREATE TABLE ${T} (chunk_id text PRIMARY KEY, act_id text NOT NULL, section_key text NOT NULL, embedding halfvec(${DIM}) NOT NULL)`]);
psql(["-c", `\\copy ${T} (chunk_id,act_id,section_key,embedding) FROM '${csv}' WITH (FORMAT csv)`]);
const t0 = Date.now();
psql(["-c", `SET maintenance_work_mem='512MB'; CREATE INDEX ${T}_hnsw ON ${T} USING hnsw (embedding halfvec_cosine_ops) WITH (m=16, ef_construction=64); CREATE INDEX ${T}_section ON ${T} (act_id, section_key); ANALYZE ${T}`]);
fs.rmSync(tmp, { recursive: true });
console.log(`loaded ${rows} rows into ${T}, skipped ${skipped} unmatched; index built in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(psql(["-c", `SELECT count(*), pg_size_pretty(pg_table_size('${T}')), pg_size_pretty(pg_relation_size('${T}_hnsw')), pg_size_pretty(pg_relation_size('${T}_section')) FROM ${T}`]).trim());
console.log(psql(["-c", "SELECT 'vector database size', pg_size_pretty(pg_database_size(current_database()))"]).trim());
