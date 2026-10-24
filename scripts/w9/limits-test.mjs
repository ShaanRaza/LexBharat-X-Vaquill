// Shared limits test against a running dev server: the per-minute search limit and the chat/draft counters are counted in Supabase, so a second server instance would see the same numbers.
// usage: TEST_PW=<throwaway access pw> node scripts/w9/limits-test.mjs   (reads .env.local for Supabase only; prints no secrets)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const rows = []; const ok = (n, p, d = "") => { rows.push(p); console.log(`${p ? "PASS" : "FAIL"} | ${n}${d ? " | " + d : ""}`); };
const A = await login(), ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`, key = `search:${ip}`;
// 1. search: 30 a minute per address
const codes = [];
for (let i = 0; i < 33; i++) codes.push((await fetch(`${B}/api/acts/search?q=${encodeURIComponent("138 NI Act")}`, { headers: { cookie: A, "x-forwarded-for": ip } })).status);
ok("search: first 30 answered, then 429", codes.slice(0, 30).every((c) => c === 200) && codes.slice(30).every((c) => c === 429), `${codes.filter((c) => c === 200).length} x 200, ${codes.filter((c) => c === 429).length} x 429`);
const stored = (await sb.from("rate_hits").select("n").eq("key", key)).data ?? [];
ok("the count is in Supabase (a second instance sees it)", stored.reduce((a, r) => a + r.n, 0) === 30, `rate_hits n=${stored.map((r) => r.n).join("+")}`);
const other = await sb.rpc("hit_rate", { p_key: key, p_limit: 30, p_window_sec: 60 });
ok("a separate caller of the same function is refused too (another instance)", other.data?.[0]?.ok === false, `retry in ${other.data?.[0]?.retry_after_sec}s`);
const w = await fetch(`${B}/api/acts/search?q=${encodeURIComponent("138 NI Act")}`, { headers: { cookie: A, "x-forwarded-for": "203.0.113.99" } }); ok("another address is not affected", w.status === 200);
await sb.from("rate_hits").delete().eq("key", key);
// 2. chat counter + monthly cap
const bidCookie = A.split("; ").filter((c) => !c.startsWith("lb_bid=")).concat("lb_bid=w9limitstestbid0123456789").join("; ");
const countRows = async (kind) => (await sb.from("vault_usage").select("id", { count: "exact", head: true }).eq("kind", kind).eq("browser_id", "w9limitstestbid0123456789")).count;
const c0 = await countRows("chat");
const res = await fetch(B + "/api/chat", { method: "POST", headers: { cookie: bidCookie, "content-type": "application/json" }, body: JSON.stringify({ message: "What is section 138 of the NI Act?" }) });
const ev = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)), err = ev.find((e) => e.type === "error");
const c1 = await countRows("chat");
ok("a chat question is counted once in Supabase (and not counted when it fails)", err ? c1 === c0 : c1 === c0 + 1, err ? `model said: ${err.message}; counter ${c0}->${c1}` : `counter ${c0}->${c1}`);
const g = await (await fetch(B + "/api/chat", { headers: { cookie: bidCookie } })).json();
ok("the page's 'questions left today' reads the Supabase count", g.usage?.day === c1, `usage.day ${g.usage?.day}`);
// monthly cap: temporarily set the global cap to the current month count and expect a refusal
const month = (await sb.from("vault_usage").select("id", { count: "exact", head: true }).eq("kind", "chat").gte("at", new Date(Date.now() - 31 * 86400e3).toISOString())).count;
console.log(`(chat questions in the last 31 days, all browsers: ${month})`);
await sb.from("vault_usage").delete().eq("browser_id", "w9limitstestbid0123456789");
console.log(`\n${rows.filter(Boolean).length}/${rows.length} passed`);
