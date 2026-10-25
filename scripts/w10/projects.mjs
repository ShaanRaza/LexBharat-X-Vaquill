// Checks the new Neon projects (never prints connection strings): reachable, size, pgvector. usage: node scripts/w10/projects.mjs [--enable-vector]
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
for (const [name, vec] of [["REG_DATABASE_URL", false], ["VECTOR_DATABASE_URL_REGULATORY", true], ["SC_DATABASE_URL", false], ["VECTOR_DATABASE_URL_SC", true], ["SC_KEYWORD_DATABASE_URL", false]]) {
  if (!env[name]) { console.log(name, "NOT SET"); continue; }
  try {
    const q = neon(env[name]).query;
    const sql = neon(env[name]);
    if (vec && process.argv.includes("--enable-vector")) await sql.query("CREATE EXTENSION IF NOT EXISTS vector");
    const r = (await sql.query("select pg_size_pretty(pg_database_size(current_database())) s, (select count(*) from pg_extension where extname='vector')::int v, current_database() d"))[0];
    console.log(name, "ok", r.s, "vector:", r.v ? "yes" : "no", vec && !r.v ? "(needed)" : "");
  } catch (e) { console.log(name, "ERROR", String(e.message).slice(0, 80)); }
}
