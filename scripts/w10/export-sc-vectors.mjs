#!/usr/bin/env node
// W10 item 10: Supreme Court chunk vectors (1024-d, voyage-4 per the dataset) from local Qdrant `legal_corpus_v2` (court_type supreme_court), truncated to 256-d and renormalised, written OUTSIDE the repo
// (../lexbharat-data/vectors/sc-qdrant-256.f32 + sc-qdrant-chunks.jsonl; chunkId "2020_INSC_548_012", actId = case id, sectionKey = chunk number "012").
// Load: VECTOR_URL_VAR=VECTOR_DATABASE_URL_SC node scripts/acts/load-qdrant-vectors.mjs sc 256     usage: QDRANT_URL=http://localhost:6333 node scripts/w10/export-sc-vectors.mjs
import fs from "node:fs";
import { truncateNormalize } from "../../src/lib/acts/fusion.mjs";

const QDRANT = process.env.QDRANT_URL ?? "http://localhost:6333", D0 = 1024, DIM = 256, PAGE = 500, OUT = "../lexbharat-data/vectors";
fs.mkdirSync(OUT, { recursive: true });
const bin = fs.openSync(`${OUT}/sc-qdrant-${DIM}.f32`, "w"), meta = fs.openSync(`${OUT}/sc-qdrant-chunks.jsonl`, "w");
let offset = null, n = 0, odd = 0;
do {
  const r = await (await fetch(`${QDRANT}/collections/legal_corpus_v2/points/scroll`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(300000),
    body: JSON.stringify({ limit: PAGE, offset, with_payload: ["chunk_id", "case_id", "language_code"], with_vector: ["dense"], filter: { must: [{ key: "court_type", match: { value: "supreme_court" } }] } }) })).json();
  if (r.status && r.status.error) throw new Error(JSON.stringify(r.status));
  const pts = r.result.points, buf = Buffer.alloc(pts.length * DIM * 4), lines = [];
  pts.forEach((p, i) => {
    const v = p.vector.dense ?? p.vector;
    if (v.length !== D0) throw new Error(`point ${p.id}: ${v.length} dimensions`);
    const out = truncateNormalize(v, DIM);
    for (let j = 0; j < DIM; j++) buf.writeFloatLE(out[j], (i * DIM + j) * 4);
    const m = /^(.+)_(\d+)$/.exec(p.payload.chunk_id);
    if (!m) odd++;
    lines.push(JSON.stringify({ chunkId: p.payload.chunk_id, actId: m ? m[1] : p.payload.case_id, sectionKey: m ? m[2] : "000", matched: !!m }));
  });
  fs.writeSync(bin, buf); fs.writeSync(meta, lines.join("\n") + "\n");
  n += pts.length; offset = r.result.next_page_offset ?? null;
  if (n % 20000 < PAGE) console.error(`${n} points`);
} while (offset !== null);
fs.closeSync(bin); fs.closeSync(meta);
console.log(JSON.stringify({ dim: DIM, points: n, oddChunkIds: odd, bytes: fs.statSync(`${OUT}/sc-qdrant-${DIM}.f32`).size }));
