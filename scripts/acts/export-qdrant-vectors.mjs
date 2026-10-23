#!/usr/bin/env node
// Reads every Central Act chunk vector (original float32, 1024-d "dense") from the open-india-law Qdrant collection `acts_india`, including the Acts that scripts/acts/fix-misfiled-central.mjs
// moved to Central. Writes, OUTSIDE the repo (../lexbharat-data/vectors/):  central-qdrant-1024.f32 (row-major float32) and central-qdrant-chunks.jsonl (one line per row: chunkId, actId, sectionKey, matched).
// "matched" = (act_id, section_key) exists in Neon act_sections. usage: QDRANT_URL=http://localhost:16333 node scripts/acts/export-qdrant-vectors.mjs
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { env } from "./bakeoff-lib.mjs";
import { parseChunkId } from "../../src/lib/acts/reassemble.mjs";

const QDRANT = process.env.QDRANT_URL ?? "http://localhost:16333", DIM = 1024, PAGE = 500, OUT = "../lexbharat-data/vectors";
fs.mkdirSync(OUT, { recursive: true });
const sql = neon(env.DATABASE_URL);
const moved = (await sql.query("SELECT act_id FROM acts WHERE category = 'central' AND raw_category = 'state'")).map((r) => r.act_id);
const known = new Set((await sql.query("SELECT s.act_id || '|' || s.section_key k FROM act_sections s JOIN acts a USING (act_id) WHERE a.category = 'central'")).map((r) => r.k));
const filter = { should: [{ key: "category", match: { value: "central" } }, { key: "act_id", match: { any: moved } }] };
const bin = fs.openSync(`${OUT}/central-qdrant-1024.f32`, "w"), meta = fs.openSync(`${OUT}/central-qdrant-chunks.jsonl`, "w");
let offset = null, n = 0, unmatched = 0, unparsed = 0, notFloat = 0;
do {
  const r = await (await fetch(`${QDRANT}/collections/acts_india/points/scroll`, { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ limit: PAGE, offset, with_payload: ["chunk_id", "act_id"], with_vector: ["dense"], filter }) })).json();
  if (r.status && r.status.error) throw new Error(JSON.stringify(r.status));
  const buf = Buffer.alloc(r.result.points.length * DIM * 4), lines = [];
  r.result.points.forEach((p, i) => {
    const v = p.vector.dense ?? p.vector;
    if (v.length !== DIM) throw new Error(`point ${p.id}: ${v.length} dimensions`);
    if (new Set(v).size <= 256) notFloat++; // an int8 copy would have at most 256 distinct values
    for (let j = 0; j < DIM; j++) buf.writeFloatLE(v[j], (i * DIM + j) * 4);
    const id = parseChunkId(p.payload.chunk_id, p.payload.act_id);
    if (!id) unparsed++;
    const sectionKey = id?.key ?? null, matched = sectionKey !== null && known.has(`${p.payload.act_id}|${sectionKey}`);
    if (!matched) unmatched++;
    lines.push(JSON.stringify({ chunkId: p.payload.chunk_id, actId: p.payload.act_id, sectionKey, matched }));
  });
  fs.writeSync(bin, buf); fs.writeSync(meta, lines.join("\n") + "\n");
  n += r.result.points.length; offset = r.result.next_page_offset ?? null;
  if (n % 10000 < PAGE) console.error(`${n} points`);
} while (offset !== null);
fs.closeSync(bin); fs.closeSync(meta);
console.log(JSON.stringify({ points: n, movedActs: moved.length, unmatchedToNeonSection: unmatched, unparsedChunkIds: unparsed, vectorsWithAtMost256DistinctValues: notFloat, bytes: fs.statSync(`${OUT}/central-qdrant-1024.f32`).size }));
