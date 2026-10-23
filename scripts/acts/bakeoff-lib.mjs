// Shared by the bake-off scripts. Reads .env.local; never prints a secret. psql gets its connection through PG* environment variables (not argv, so the URL is not in the process list).
import fs from "node:fs";
export const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
export function pgEnv(name) {
  const u = new URL(env[name]);
  return { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1), PGSSLMODE: "require", PGCONNECT_TIMEOUT: "30" };
}
export const redact = (s) => String(s).replace(/postgres(ql)?:\/\/[^\s'"]+/g, "<redacted>").replace(/Bearer\s+\S+/g, "Bearer <redacted>");
// BAKEOFF_TAG="-pilot" switches every file to the small pilot corpus (used while Voyage limits the account to 3 requests and 10K tokens per minute).
export const TAG = process.env.BAKEOFF_TAG ?? "";
export const DIM_FILE = `../lexbharat-data/vectors/central-1024${TAG}.f32`, CHUNKS_FILE = `../lexbharat-data/vectors/central-chunks${TAG}.jsonl`, SECTIONS_FILE = `../lexbharat-data/vectors/central-sections${TAG}.json`;
/** Voyage query/document embeddings with retry; returns { vecs, tokens }. */
export async function voyage(input, inputType, dim = 1024) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch("https://api.voyageai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ input, model: "voyage-4", input_type: inputType, output_dimension: dim }) });
    if (r.status === 429 || r.status >= 500) { if (attempt > 12) throw new Error(`Voyage ${r.status} after retries`); await new Promise((x) => setTimeout(x, Math.min(60000, 5000 * 2 ** Math.min(attempt, 4)))); continue; }
    if (!r.ok) throw new Error(`Voyage error ${r.status}`);
    const j = await r.json(); return { vecs: j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding), tokens: j.usage.total_tokens };
  }
}
