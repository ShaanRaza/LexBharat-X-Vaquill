#!/usr/bin/env node
// Bake-off step 3: loads the embedded Central chunks into the VECTOR database as halfvec tables (one per size) with HNSW indexes.
// 512 and 256 are made from the stored 1024 vectors by truncating and renormalising. usage: node scripts/acts/bakeoff-load.mjs [prefix=emb] [dims=1024,512,256]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pgEnv, redact, DIM_FILE, CHUNKS_FILE } from "./bakeoff-lib.mjs";
import { truncateNormalize } from "../../src/lib/acts/fusion.mjs";

const PREFIX = process.argv[2] ?? "emb", DIMS = (process.argv[3] ?? "1024,512,256").split(",").map(Number), D0 = 1024;
const rows = Math.floor(fs.statSync(DIM_FILE).size / (D0 * 4));
const chunks = fs.readFileSync(CHUNKS_FILE, "utf8").split("\n").filter(Boolean).slice(0, rows).map((l) => JSON.parse(l));
const buf = fs.readFileSync(DIM_FILE);
const psql = (args, input) => { try { return execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-At", ...args], { env: pgEnv("VECTOR_DATABASE_URL"), input, maxBuffer: 1 << 28 }).toString(); } catch (e) { throw new Error(redact(e.stderr?.toString() ?? e.message)); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bakeoff-"));
console.log(`rows to load: ${rows}`);
for (const dim of DIMS) {
  const t = `${PREFIX}_${dim}`, csv = path.join(tmp, `${t}.csv`), out = fs.createWriteStream(csv);
  for (let i = 0; i < rows; i++) {
    const v = new Float32Array(buf.buffer, buf.byteOffset + i * D0 * 4, D0), x = dim === D0 ? Array.from(v) : truncateNormalize(v, dim);
    out.write(`${i},${chunks[i].actId},${chunks[i].sectionKey},${chunks[i].part},"[${x.map((n) => +n.toFixed(7)).join(",")}]"\n`);
  }
  out.end(); await new Promise((r) => out.on("finish", r));
  psql(["-c", `DROP TABLE IF EXISTS ${t}; CREATE TABLE ${t} (id integer PRIMARY KEY, act_id text NOT NULL, section_key text NOT NULL, part integer NOT NULL, embedding halfvec(${dim}) NOT NULL)`]);
  psql(["-c", `\\copy ${t} (id,act_id,section_key,part,embedding) FROM '${csv}' WITH (FORMAT csv)`]);
  const t0 = Date.now();
  psql(["-c", `SET maintenance_work_mem='512MB'; CREATE INDEX ${t}_hnsw ON ${t} USING hnsw (embedding halfvec_cosine_ops) WITH (m=16, ef_construction=64); ANALYZE ${t}`]);
  console.log(psql(["-c", `SELECT '${t}', count(*), pg_size_pretty(pg_table_size('${t}')), pg_size_pretty(pg_relation_size('${t}_hnsw'))  FROM ${t}`]).trim(), `(index built in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  fs.rmSync(csv);
}
console.log(psql(["-c", "SELECT 'vector database size', pg_size_pretty(pg_database_size(current_database()))"]).trim());
