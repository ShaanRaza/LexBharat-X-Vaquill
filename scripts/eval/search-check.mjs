#!/usr/bin/env node
// Search-only checks: the query goes through the real GET /api/acts/search of a LOCAL server (no AI call; search by meaning uses the Voyage embedding, throttled and cached by scripts/eval/serve.sh) and the expected
// section must be within the first `top` results. usage: node scripts/eval/search-check.mjs <label> [--base http://localhost:3100]   -> docs/eval/runs/search-<label>.json
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const label = process.argv[2]; if (!label || label.startsWith("--")) { console.log("usage: node scripts/eval/search-check.mjs <label> [--base url]"); process.exit(1); }
const BASE = arg("base", "http://localhost:3100"), PASSWORD = process.env.EVAL_ACCESS_PASSWORD ?? "throwaway-local-test-9";
const db = neon(process.env.DATABASE_URL), norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const checks = JSON.parse(fs.readFileSync("docs/eval/search-checks.json", "utf8")).checks;
const jar = new Map(), keep = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"), i = kv.indexOf("="); jar.set(kv.slice(0, i), kv.slice(i + 1)); } }, cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
keep(await fetch(`${BASE}/api/access/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PASSWORD }) }));
const rows = [];
for (const c of checks) {
  const gold = await db.query(`SELECT s.act_id, s.section_key FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id WHERE a.category = 'central' AND lower(a.title) LIKE lower($1) || '%' AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`, [c.act.replace(/,.*$/, ""), norm(c.anchor)]);
  const keys = new Set(gold.map((g) => `${g.act_id}|${g.section_key}`));
  let j = null; for (let k = 0; k < 3 && !j?.results; k++) { const r = await fetch(`${BASE}/api/acts/search?q=${encodeURIComponent(c.q)}`, { headers: { cookie: cookie() } }); j = await r.json().catch(() => null); if (!j?.results) await new Promise((res) => setTimeout(res, 25000)); }
  const res = j?.results ?? [], rank = res.findIndex((h) => keys.has(`${h.actId}|${h.sectionKey}`)) + 1 || null;
  const ok = rank !== null && rank <= c.top;
  rows.push({ id: c.id, q: c.q, top: c.top, rank, ok, mode: j?.mode ?? null, first: res.slice(0, 5).map((h) => `${h.actTitle.replace(/^The /, "").slice(0, 28)} s${h.number ?? "?"}`) });
  console.log(`${c.id} ${ok ? "PASS" : "FAIL"} rank=${rank ?? "-"} (need <= ${c.top}) "${c.q}" -> ${rows.at(-1).first.slice(0, 3).join(" | ")}`);
}
fs.mkdirSync("docs/eval/runs", { recursive: true }); fs.writeFileSync(`docs/eval/runs/search-${label}.json`, JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log(`\n${label}: ${rows.filter((r) => r.ok).length}/${rows.length} pass`);
