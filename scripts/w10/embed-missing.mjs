#!/usr/bin/env node
// W10 item 2: embeds the shown sections that have text but no vector (voyage-4, 256-d, normal API, input_type document, one request per 21 s for the free account).
// usage: node scripts/w10/embed-missing.mjs [--apply]     (dry run lists counts)
import { q, vq } from "./env.mjs";
import { chunkSection } from "../../src/lib/acts/chunking.mjs";
const APPLY = process.argv.includes("--apply"), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keys = await q(`SELECT s.act_id, s.section_key FROM act_sections_v s WHERE length(trim(coalesce(s.body,''))) > 0 AND s.status <> 'garbled' AND s.act_id NOT IN (SELECT act_id FROM acts WHERE false)`);
const have = new Set();
for (const t of ["central_emb_256", "state_emb_256", "supplement_emb_256"]) for (const r of await vq(`SELECT DISTINCT act_id || '|' || section_key AS k FROM ${t}`)) have.add(r.k);
const miss = keys.filter((s) => !have.has(`${s.act_id}|${s.section_key}`));
const todo = miss.length ? await q(`SELECT s.act_id, s.section_key, s.number, s.heading, s.body, s.status, a.title, a.year, a.category FROM act_sections_v s JOIN acts a USING (act_id) WHERE (s.act_id || '|' || s.section_key) = ANY($1) AND s.status <> 'garbled'`, [miss.map((s) => `${s.act_id}|${s.section_key}`)]) : [];
console.log("shown sections with text:", keys.length, "| without vector:", todo.length, "| central", todo.filter((t) => t.category === "central").length, "state", todo.filter((t) => t.category !== "central").length);
const chunks = todo.flatMap((s) => chunkSection({ actTitle: s.title, year: s.year, number: s.number, heading: s.heading, body: s.body }).map((c, i) => ({ id: `${s.act_id}_${s.section_key}_w10_${i + 1}`, actId: s.act_id, key: s.section_key, text: c.text, cat: s.category })));
console.log("passages:", chunks.length, "| chars:", chunks.reduce((a, c) => a + c.text.length, 0));
if (!APPLY) process.exit(0);
async function embed(texts) {
  for (let a = 0; a < 5; a++) {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY.trim()}`, "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ input: texts, model: "voyage-4", input_type: "document", output_dimension: 256, truncation: true }) });
    if (r.status === 429) { await sleep(30000); continue; }
    if (!r.ok) throw new Error(`voyage ${r.status}`);
    return (await r.json()).data.sort((x, y) => x.index - y.index).map((d) => d.embedding);
  }
  throw new Error("voyage busy");
}
let done = 0;
for (let i = 0; i < chunks.length; i += 8) {
  if (i) await sleep(21000);
  const b = chunks.slice(i, i + 8), vs = await embed(b.map((c) => c.text));
  for (let j = 0; j < b.length; j++) await vq(`INSERT INTO ${b[j].cat === "central" ? "central_emb_256" : "state_emb_256"} (chunk_id, act_id, section_key, embedding) VALUES ($1,$2,$3,$4::halfvec) ON CONFLICT (chunk_id) DO NOTHING`, [b[j].id, b[j].actId, b[j].key, `[${vs[j].map((n) => +n.toFixed(7)).join(",")}]`]);
  done += b.length; console.log(`embedded ${done}/${chunks.length}`);
}
