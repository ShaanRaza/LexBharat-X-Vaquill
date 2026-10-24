// Loads .env.local into process.env (never prints it) and returns a Neon query helper.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
export const sql = neon(process.env.DATABASE_URL);
export const q = (t, p = []) => sql.query(t, p);
export const vsql = process.env.VECTOR_DATABASE_URL ? neon(process.env.VECTOR_DATABASE_URL) : null;
export const vq = (t, p = []) => vsql.query(t, p);
