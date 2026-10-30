#!/usr/bin/env node
// READ-ONLY: writes the section numbers, headings and status of the six criminal-law Acts from our database to a JSON file, for build-law-mapping.py (which checks the mapping against our data).
// usage: node scripts/concord/dump-headings.mjs <out.json>
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sql = neon(process.env.DATABASE_URL), laws = JSON.parse(fs.readFileSync("src/config/law-mapping.json", "utf8")).laws, out = {};
for (const [k, l] of Object.entries(laws)) {
  const r = await sql.query(`SELECT number, heading, status FROM act_sections_v WHERE act_id = $1 AND number IS NOT NULL`, [l.actId]);
  out[k] = Object.fromEntries(r.map((x) => [String(x.number).toUpperCase(), { h: x.heading, s: x.status }]));
  console.log(k, l.actId, Object.keys(out[k]).length, "sections");
}
fs.writeFileSync(process.argv[2] ?? "headings.json", JSON.stringify(out));
