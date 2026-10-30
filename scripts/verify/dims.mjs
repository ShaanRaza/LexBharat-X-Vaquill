// Are the stored vectors the size the app expects? Table column type, dimensions and row estimate for every vector table (central, state, supplement, regulatory, sc). Read-only. Run: node scripts/verify/dims.mjs
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const urls = { central: process.env.VECTOR_DATABASE_URL, state: process.env.VECTOR_DATABASE_URL, supplement: process.env.VECTOR_DATABASE_URL, regulatory: process.env.VECTOR_DATABASE_URL_REGULATORY || process.env.VECTOR_DATABASE_URL, sc: process.env.VECTOR_DATABASE_URL_SC };
for (const [c, u] of Object.entries(urls)) {
  const sql = neon(u), t = `${c}_emb_256`;
  try {
    const r = await sql.query(`SELECT count(*)::int AS n, min(vector_dims(embedding)) AS dmin, max(vector_dims(embedding)) AS dmax FROM (SELECT embedding FROM ${t} LIMIT 2000) x`);
    const est = await sql.query(`SELECT reltuples::bigint AS est FROM pg_class WHERE relname = $1`, [t]);
    const col = await sql.query(`SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute WHERE attrelid = $1::regclass AND attname = 'embedding'`, [t]);
    console.log(c, t, JSON.stringify({ ...r[0], estRows: est[0]?.est, type: col[0]?.type }));
  } catch (e) { console.log(c, t, "ERR", String(e.message).slice(0, 100)); }
}
