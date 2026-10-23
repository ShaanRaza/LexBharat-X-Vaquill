#!/usr/bin/env node
// Applies scripts/drafting/drafting-schema.sql to the main Neon database (DATABASE_URL from .env.local; never printed). Safe to run again.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { env } from "../acts/bakeoff-lib.mjs";

const sql = neon(env.DATABASE_URL);
for (const stmt of fs.readFileSync("scripts/drafting/drafting-schema.sql", "utf8").replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
const r = await sql.query("SELECT (SELECT count(*) FROM drafts)::int drafts, (SELECT count(*) FROM draft_versions)::int versions, pg_size_pretty(pg_database_size(current_database())) size");
console.log("drafting tables ready:", JSON.stringify(r[0]));
