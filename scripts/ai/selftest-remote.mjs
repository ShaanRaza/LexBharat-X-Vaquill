// Signs in to a deployment with ACCESS_PASSWORD from .env.local and prints the self-test rows (stage, ok, ms, detail). NEVER prints the password.
// usage: node scripts/ai/selftest-remote.mjs https://app.lexbharat.ai "voyage=1&gemini=1&openrouter=1"
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^["']|["']$/g, "")]));
const [base, qs = ""] = process.argv.slice(2), jar = [];
const keep = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) jar.push(c.split(";")[0]); };
const login = await fetch(`${base}/api/access/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: env.ACCESS_PASSWORD }) }); keep(login);
if (!login.ok) { console.log("login failed", login.status); process.exit(1); }
const home = await fetch(`${base}/`, { headers: { cookie: jar.join("; ") }, redirect: "manual" }); keep(home);
const r = await fetch(`${base}/api/vault/selftest?${qs}`, { headers: { cookie: [...new Set(jar)].join("; ") } });
const j = await r.json().catch(() => null);
if (!j?.rows) { console.log("no rows", r.status); process.exit(1); }
for (const x of j.rows) console.log(`${x.ok ? "OK  " : "FAIL"} | ${x.stage} | ${x.ms} ms | ${x.detail}`);
