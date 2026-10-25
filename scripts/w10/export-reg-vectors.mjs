#!/usr/bin/env node
// W10 item 7: reads the regulator chunk vectors (original float32, 1024-d "dense") from the open-india-law Qdrant collection `acts_india` (category "regulatory"), truncates them to 256 dimensions and
// renormalises (Matryoshka; identical to asking Voyage for 256), and writes them OUTSIDE the repo (../lexbharat-data/vectors/regulatory-qdrant-256.f32 + regulatory-qdrant-chunks.jsonl).
// "matched" = the (act_id, section_key) exists in reg_sections with shown text. Load them with: VECTOR_URL_VAR=VECTOR_DATABASE_URL_REGULATORY node scripts/acts/load-qdrant-vectors.mjs regulatory 256
// usage: QDRANT_URL=http://localhost:6333 node scripts/w10/export-reg-vectors.mjs [--departments=dgft,cbic]
import fs from "node:fs";
import { rq as q } from "./env.mjs";
import { parseChunkId } from "../../src/lib/acts/reassemble.mjs";
import { truncateNormalize } from "../../src/lib/acts/fusion.mjs";

const QDRANT = process.env.QDRANT_URL ?? "http://localhost:6333", D0 = 1024, DIM = 256, PAGE = 500, OUT = "../lexbharat-data/vectors";
const DEPTS = (process.argv.find((a) => a.startsWith("--departments=")) ?? "").slice(14).split(",").filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const known = new Set((await q("SELECT act_id || '|' || section_key AS k FROM reg_sections WHERE length(btrim(coalesce(body, ''))) >= 30")).map((r) => r.k));
const filter = { must: [{ key: "category", match: { value: "regulatory" } }, ...(DEPTS.length ? [{ key: "department", match: { any: DEPTS } }] : [])] };
const bin = fs.openSync(`${OUT}/regulatory-qdrant-${DIM}.f32`, "w"), meta = fs.openSync(`${OUT}/regulatory-qdrant-chunks.jsonl`, "w");
let offset = null, n = 0, unmatched = 0, unparsed = 0;
do {
  const r = await (await fetch(`${QDRANT}/collections/acts_india/points/scroll`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(180000),
    body: JSON.stringify({ limit: PAGE, offset, with_payload: ["chunk_id", "act_id"], with_vector: ["dense"], filter }) })).json();
  if (r.status && r.status.error) throw new Error(JSON.stringify(r.status));
  const buf = Buffer.alloc(r.result.points.length * DIM * 4), lines = [];
  r.result.points.forEach((p, i) => {
    const v = p.vector.dense ?? p.vector;
    if (v.length !== D0) throw new Error(`point ${p.id}: ${v.length} dimensions`);
    const out = truncateNormalize(v, DIM);
    for (let j = 0; j < DIM; j++) buf.writeFloatLE(out[j], (i * DIM + j) * 4);
    const id = parseChunkId(p.payload.chunk_id, p.payload.act_id);
    if (!id) unparsed++;
    const sectionKey = id?.key ?? null, matched = sectionKey !== null && known.has(`${p.payload.act_id}|${sectionKey}`);
    if (!matched) unmatched++;
    lines.push(JSON.stringify({ chunkId: p.payload.chunk_id, actId: p.payload.act_id, sectionKey, matched }));
  });
  fs.writeSync(bin, buf); fs.writeSync(meta, lines.join("\n") + "\n");
  n += r.result.points.length; offset = r.result.next_page_offset ?? null;
  if (n % 20000 < PAGE) console.error(`${n} points`);
} while (offset !== null);
fs.closeSync(bin); fs.closeSync(meta);
console.log(JSON.stringify({ departments: DEPTS.length ? DEPTS : "all", dim: DIM, points: n, unmatchedToSection: unmatched, unparsedChunkIds: unparsed, bytes: fs.statSync(`${OUT}/regulatory-qdrant-${DIM}.f32`).size }));
