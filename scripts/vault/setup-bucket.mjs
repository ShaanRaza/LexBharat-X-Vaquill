// Makes the private bucket enforce the file rules too (10 MB, PDF/Word/text only). Reads .env.local; prints no secrets. usage: node scripts/vault/setup-bucket.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const name = process.env.VAULT_BUCKET || "Vault";
const { error } = await sb.storage.updateBucket(name, { public: false, fileSizeLimit: 10 * 1024 * 1024, allowedMimeTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "image/jpeg", "image/png"] });
console.log(error ? `failed: ${error.message}` : `bucket ${name}: private, 10 MB, pdf/docx/txt/jpg/png only`);
