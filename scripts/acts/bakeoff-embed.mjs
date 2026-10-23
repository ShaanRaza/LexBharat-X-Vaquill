#!/usr/bin/env node
// Bake-off step 2: embeds the Central chunks ONCE with voyage-4 at 1024 dimensions (float) and appends them to ../lexbharat-data/vectors/central-1024.f32
// (float32, row i = chunk i). Resumable: re-running continues after the rows already written. The 512 and 256 versions are made by truncating and renormalising these
// vectors (voyage-4 is Matryoshka: truncated 1024 matches the API's native 256 to cosine 1.0000, checked in bakeoff-verify). Tokens used are summed from the API's own `usage`.
// Hard stop at TOKEN_CAP. The key is read from .env.local and never printed.
import fs from "node:fs";
import path from "node:path";
import { TAG } from "./bakeoff-lib.mjs";

const DIR = path.resolve("../lexbharat-data/vectors"), F32 = path.join(DIR, `central-1024${TAG}.f32`), META = path.join(DIR, `embed-progress${TAG}.json`);
const TOKEN_CAP = 28_000_000, DIM = 1024, MAX_ITEMS = 128, MAX_CHARS = Number(process.env.MAX_CHARS ?? 130_000), CONCURRENCY = Number(process.env.CONC ?? 3), PACE_MS = Number(process.env.PACE_MS ?? 0); // PACE_MS: minimum gap between requests (low-limit accounts)
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const KEY = env.VOYAGE_API_KEY;
if (!KEY) { console.error("VOYAGE_API_KEY missing in .env.local"); process.exit(1); }

const chunks = fs.readFileSync(path.join(DIR, `central-chunks${TAG}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const done = fs.existsSync(F32) ? Math.floor(fs.statSync(F32).size / (DIM * 4)) : 0;
const prog = fs.existsSync(META) ? JSON.parse(fs.readFileSync(META, "utf8")) : { tokens: 0, requests: 0, retries: 0, rateLimited: 0 };
console.log(`chunks ${chunks.length}, already embedded ${done}, tokens so far ${prog.tokens}`);

// batches from `done` onwards
const batches = [];
for (let i = done; i < chunks.length;) { let j = i, c = 0; while (j < chunks.length && j - i < MAX_ITEMS && c + chunks[j].text.length <= MAX_CHARS) c += chunks[j++].text.length; if (j === i) j = i + 1; batches.push([i, j]); i = j; }

async function embedBatch([a, b]) {
  const input = chunks.slice(a, b).map((c) => c.text);
  for (let attempt = 0; ; attempt++) {
    let r;
    try { r = await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ input, model: "voyage-4", input_type: "document", output_dimension: DIM }), signal: AbortSignal.timeout(90000) }); }
    catch { prog.retries++; await new Promise((x) => setTimeout(x, Math.min(60000, 1000 * 2 ** attempt))); continue; }
    if (r.status === 429 || r.status >= 500) { prog.retries++; if (r.status === 429) prog.rateLimited++; const ra = Number(r.headers.get("retry-after")); await new Promise((x) => setTimeout(x, ra ? ra * 1000 : Math.min(60000, 1500 * 2 ** attempt))); if (attempt > 40) throw new Error(`gave up after ${attempt} retries (status ${r.status})`); continue; }
    if (!r.ok) throw new Error(`Voyage error ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return { a, b, vecs: j.data.sort((x, y) => x.index - y.index).map((d) => d.embedding), tokens: j.usage.total_tokens };
  }
}

const out = fs.openSync(F32, "a");
const results = new Map();
let next = 0, writeFrom = 0, stop = false;
const t0 = Date.now();
function flushInOrder() {
  while (results.has(writeFrom)) {
    const { b, vecs, tokens } = results.get(writeFrom); results.delete(writeFrom);
    const buf = Buffer.alloc(vecs.length * DIM * 4);
    vecs.forEach((v, i) => v.forEach((x, k) => buf.writeFloatLE(x, (i * DIM + k) * 4)));
    fs.writeSync(out, buf); prog.tokens += tokens; prog.requests++;
    fs.writeFileSync(META, JSON.stringify(prog));
    writeFrom = b;
  }
}
async function worker() {
  while (!stop) {
    const k = next++; if (k >= batches.length) return;
    if (prog.tokens > TOKEN_CAP) { stop = true; console.error(`STOP: token cap ${TOKEN_CAP} reached`); return; }
    if (PACE_MS) await new Promise((x) => setTimeout(x, PACE_MS));
    const r = await embedBatch(batches[k]);
    results.set(r.a, r); flushInOrder();
    if (k % 20 === 0) console.log(`batch ${k}/${batches.length} rows ${writeFrom}/${chunks.length} tokens ${prog.tokens} retries ${prog.retries} ${(Date.now() - t0) / 1000 | 0}s`);
  }
}
if (batches.length) writeFrom = batches[0][0];
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
flushInOrder(); fs.closeSync(out);
console.log(JSON.stringify({ rows: Math.floor(fs.statSync(F32).size / (DIM * 4)), ...prog, seconds: (Date.now() - t0) / 1000 | 0 }));
