// Reads .env.local; lists OpenRouter models (id, per-million-token prices, context) matching a pattern, and the key's credit/limit. NEVER prints the key.
// usage: node scripts/ai/openrouter-info.mjs [regex]     (no regex: only the key's credit)
import fs from "node:fs";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const key = process.env.OPENROUTER_API_KEY?.trim(); if (!key) { console.log("OPENROUTER_API_KEY is not set"); process.exit(1); }
const h = { Authorization: `Bearer ${key}` };
const k = await fetch("https://openrouter.ai/api/v1/key", { headers: h }).then((r) => r.json());
if (k.error) { console.log("key check failed:", k.error.code ?? k.error.message); process.exit(1); }
const { label, limit, limit_remaining, usage, is_free_tier, limit_reset } = k.data ?? {};
console.log(JSON.stringify({ limit, limit_remaining, usage, is_free_tier, limit_reset }));
const pat = process.argv[2]; if (!pat) process.exit(0);
const ms = (await fetch("https://openrouter.ai/api/v1/models", { headers: h }).then((r) => r.json())).data ?? [];
const re = new RegExp(pat, "i");
for (const m of ms.filter((m) => re.test(m.id)).sort((a, b) => a.id.localeCompare(b.id))) console.log(`${m.id} | in $${(m.pricing.prompt * 1e6).toFixed(3)} out $${(m.pricing.completion * 1e6).toFixed(3)} per 1M | ctx ${m.context_length}`);
