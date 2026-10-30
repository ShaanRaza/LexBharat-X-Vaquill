// Do the stored vectors come from the model and size the app embeds queries with (voyage-4, 256)? Re-embeds a few stored passages per corpus with voyage-4 (normal API, one request) and compares with the stored vector.
// Same model and size -> cosine close to 1 for the same text; a different model or size -> about 0 (unrelated spaces). Read-only. Run: node scripts/verify/model-check.mjs
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import { chunkSection } from "../../src/lib/acts/chunking.mjs";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const N = Number(process.argv[2] ?? 3);
const main = neon(process.env.DATABASE_URL), reg = neon(process.env.REG_DATABASE_URL || process.env.DATABASE_URL), sc = neon(process.env.SC_DATABASE_URL);
const vec = (c) => neon(c === "regulatory" ? process.env.VECTOR_DATABASE_URL_REGULATORY || process.env.VECTOR_DATABASE_URL : c === "sc" ? process.env.VECTOR_DATABASE_URL_SC : process.env.VECTOR_DATABASE_URL);
const items = [];   // { corpus, id, text, vecDb }
for (const c of ["central", "state", "regulatory"]) {
  const v = vec(c), t = `${c}_emb_256`;
  const rows = await v.query(`SELECT chunk_id, act_id, section_key FROM ${t} TABLESAMPLE SYSTEM (0.2) WHERE chunk_id NOT LIKE '%_w10_%' LIMIT 400`);
  let got = 0;
  for (const r of rows.sort(() => Math.random() - 0.5)) {
    if (got >= N) break;
    const [{ n }] = await v.query(`SELECT count(*)::int AS n FROM ${t} WHERE act_id = $1 AND section_key = $2`, [r.act_id, r.section_key]);
    if (n !== 1) continue;   // a one-chunk section: the passage is the whole (prefixed) section
    const db = c === "regulatory" ? reg : main, tbl = c === "regulatory" ? ["reg_sections", "reg_acts"] : ["act_sections_v", "acts"];
    const s = (await db.query(`SELECT s.number, s.heading, s.body, a.title, a.year FROM ${tbl[0]} s JOIN ${tbl[1]} a USING (act_id) WHERE s.act_id = $1 AND s.section_key = $2`, [r.act_id, r.section_key]))[0];
    if (!s?.body) continue;
    const ch = chunkSection({ actTitle: s.title, year: s.year, number: s.number, heading: s.heading, body: s.body });
    if (ch.length !== 1) continue;
    items.push({ corpus: c, id: r.chunk_id, text: ch[0].text, key: [r.act_id, r.section_key], v }); got++;
  }
}
{
  const v = vec("sc"), rows = await v.query(`SELECT chunk_id, act_id, section_key FROM sc_emb_256 TABLESAMPLE SYSTEM (0.2) LIMIT 60`);
  let got = 0;
  for (const r of rows) {
    if (got >= N) break;
    const b = await sc.query(`SELECT blob FROM sc_cases WHERE case_id = $1`, [r.act_id]); if (!b.length) continue;
    const buf = typeof b[0].blob === "string" ? Buffer.from(b[0].blob.replace(/^\\x/, ""), "hex") : Buffer.from(b[0].blob);
    const ch = JSON.parse(gunzipSync(buf).toString("utf8")).find((c) => String(c.i) === String(parseInt(r.section_key, 10)));
    if (!ch) continue;
    items.push({ corpus: "sc", id: r.chunk_id, text: ch.t, key: [r.act_id, r.section_key], v }); got++;
  }
}
const res = await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${process.env.VOYAGE_API_KEY.trim()}`, "Content-Type": "application/json" },
  body: JSON.stringify({ input: items.map((i) => i.text), model: "voyage-4", input_type: "document", output_dimension: 256, truncation: true }) });
if (!res.ok) { console.log("voyage", res.status); process.exit(1); }
const emb = (await res.json()).data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
const out = [];
for (let i = 0; i < items.length; i++) {
  const it = items[i], lit = `[${emb[i].join(",")}]`, t = `${it.corpus}_emb_256`;
  const [same] = await it.v.query(`SELECT 1 - (embedding <=> $1::halfvec) AS cos FROM ${t} WHERE chunk_id = $2`, [lit, it.id]);
  const [rnd] = await it.v.query(`SELECT avg(1 - (embedding <=> $1::halfvec)) AS cos FROM (SELECT embedding FROM ${t} TABLESAMPLE SYSTEM (0.05) LIMIT 50) x`, [lit]);
  out.push({ corpus: it.corpus, chunk: it.id.slice(0, 40), cosWithStored: +Number(same.cos).toFixed(4), cosWithRandomStored: +Number(rnd.cos).toFixed(4) });
}
console.table(out);
