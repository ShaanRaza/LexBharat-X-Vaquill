// Checks that the Vault tables, the search function and the storage bucket exist (reads .env.local; prints no secrets). usage: node scripts/vault/check-schema.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
let bad = 0;
for (const t of ["vault_documents", "vault_texts", "vault_chunks", "review_runs", "vault_usage"]) {
  const { error } = await sb.from(t).select("*", { head: true, count: "exact" });
  console.log(t.padEnd(18), error ? `MISSING (${error.code ?? ""} ${error.message})` : "ok"); if (error) bad++;
}
const z = new Array(256).fill(0); z[0] = 1;
const r = await sb.rpc("match_vault_chunks", { query_embedding: z, p_browser: "none", p_doc_ids: null, p_k: 1 });
console.log("match_vault_chunks".padEnd(18), r.error ? `MISSING (${r.error.message})` : "ok"); if (r.error) bad++;
const b = await sb.storage.listBuckets(); console.log("buckets:", (b.data ?? []).map((x) => `${x.name}${x.public ? " (PUBLIC!)" : ""}`).join(", "));
process.exit(bad ? 1 : 0);
