// Prints how much space the Vault uses: Supabase database and file storage, and the Neon main database size (to show it did not change). Reads .env.local; prints no secrets. usage: node scripts/vault/sizes.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { neon } from "@neondatabase/serverless";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const mb = (b) => `${(Number(b) / 1048576).toFixed(1)} MB`;
const s = await sb.rpc("vault_sizes"); const row = Array.isArray(s.data) ? s.data[0] : s.data;
const walk = async (prefix) => { let n = 0, bytes = 0; const { data } = await sb.storage.from(process.env.VAULT_BUCKET || "Vault").list(prefix, { limit: 1000 }); for (const o of data ?? []) { if (o.id === null) { const r = await walk(prefix ? `${prefix}/${o.name}` : o.name); n += r.n; bytes += r.bytes; } else { n++; bytes += Number(o.metadata?.size ?? 0); } } return { n, bytes }; };
const st = await walk("");
console.log(`Supabase database: ${row ? mb(row.db_bytes) : "?"} of 500 MB (documents ${row?.documents}, passages ${row?.chunks})`);
console.log(`Supabase storage:  ${mb(st.bytes)} of 1024 MB in ${st.n} file(s)`);
try { const sql = neon(process.env.DATABASE_URL); const r = await sql`select pg_database_size(current_database()) as b`; console.log(`Neon main database: ${mb(r[0].b)}`); } catch { console.log("Neon main database: could not read"); }
