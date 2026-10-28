// Feedback and usage-stat tests against a running dev server. usage: TEST_PW=<access pw> ADMIN_PW=<admin pw> node scripts/w8/feedback-test.mjs   (reads .env.local only to look at the counters behind the API; prints no secrets)
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { api, login } from "./scan-test.mjs";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const B = process.env.BASE ?? "http://localhost:3100", sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = []; const ok = (name, pass, detail = "") => { rows.push([name, pass ? "PASS" : "FAIL", detail]); console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`); };
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const counter = async (metric, key = "") => (await sb.from("usage_daily").select("n,sum_ms").eq("day", today()).eq("metric", metric).eq("key", key).maybeSingle()).data ?? { n: 0, sum_ms: 0 };
const A = await login(), O = await login();
const post = (c, body) => api(c, "/api/feedback", { method: "POST", body: JSON.stringify(body) });
const votes = async (c, ids) => (await (await api(c, `/api/feedback?feature=chat&ids=${ids.join(",")}`)).json()).votes;

// a real chat answer to rate
const before = await counter("chat_asked"), beforeT = await counter("answer_time", "chat");
const res = await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message: "What is the punishment for dishonour of a cheque under section 138 of the NI Act?" }) });
const ev = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)), done = ev.find((e) => e.type === "done"), id = String(done?.messageId);
ok("chat answer ends with its message id (the thumbs hang on it)", !!done?.messageId, `id ${id}`);
await sleep(1500);
const after = await counter("chat_asked"), afterT = await counter("answer_time", "chat");
ok("stats: one question counted once, with its answer time", after.n === before.n + 1 && afterT.n === beforeT.n + 1 && afterT.sum_ms > beforeT.sum_ms, `chats ${before.n}->${after.n}; avg answer ${Math.round((afterT.sum_ms - beforeT.sum_ms) / 1000)} s`);

// votes
let r = await post(A, { feature: "chat", itemId: id, vote: "up" });
ok("thumbs up saved", r.status === 200, JSON.stringify(await r.json()));
ok("my vote is shown back", (await votes(A, [id]))[id]?.vote === "up");
r = await post(A, { feature: "chat", itemId: id, vote: "down", reasons: ["Wrong law", "Bogus pick", "Too vague"], comment: "It did not mention the 2 year limit." });
ok("vote changed to thumbs down with quick picks and a comment", r.status === 200);
const mine = (await votes(A, [id]))[id];
ok("changed vote, picks (unknown pick dropped) and comment are returned", mine?.vote === "down" && mine.comment.startsWith("It did not") && JSON.stringify(mine.reasons) === JSON.stringify(["Wrong law", "Too vague"]), JSON.stringify(mine));
const stored = (await sb.from("feedback").select("*").eq("item_id", id)).data ?? [];
ok("one row per browser and item (changing the vote does not add a row)", stored.length === 1 && stored[0].vote === "down", `rows ${stored.length}; model ${stored[0]?.model}; browser stored as a ${String(stored[0]?.browser_hash).length}-char hash`);
ok("snapshot holds the question, the answer and citation labels", /cheque/i.test(stored[0]?.snapshot?.question ?? "") && (stored[0]?.snapshot?.answer ?? "").length > 50 && Array.isArray(stored[0]?.snapshot?.citations), `citations: ${(stored[0]?.snapshot?.citations ?? []).slice(0, 3).join("; ")}`);
r = await post(A, { feature: "chat", itemId: id, vote: "up" }); const back = (await votes(A, [id]))[id];
ok("back to thumbs up clears the picks and comment", r.status === 200 && back.vote === "up" && back.comment === "" && back.reasons.length === 0);
await post(A, { feature: "chat", itemId: id, vote: "down", reasons: ["Missing law"], comment: "Needs the section 143 summary trial point." });
// safety
ok("another browser cannot vote on my answer", (await post(O, { feature: "chat", itemId: id, vote: "down" })).status === 404);
ok("bad payloads are refused", (await post(A, { feature: "chat", itemId: id, vote: "meh" })).status === 422 && (await post(A, { feature: "x", itemId: id, vote: "up" })).status === 422 && (await post(A, { feature: "chat", itemId: "a b", vote: "up" })).status === 422);
// visits counted once per browser per page per day
const v0 = await counter("visit", "chat");
for (let i = 0; i < 3; i++) await api(A, "/api/usage/visit", { method: "POST", body: JSON.stringify({ page: "chat" }) });
await api(A, "/api/usage/visit", { method: "POST", body: JSON.stringify({ page: "not-a-page" }) });
await sleep(800); const v1 = await counter("visit", "chat");
ok("three visits to the same page by one browser count once; unknown pages are ignored", v1.n === v0.n + 1, `${v0.n}->${v1.n}`);

// admin
const adm = await api(A, "/admin"), html = await adm.text();
ok("admin page without the admin password shows only the login form (no data)", adm.status === 200 && /Admin password/.test(html) && !/Thumbs-down feedback/.test(html) && !/It did not mention/.test(html));
ok("feedback CSV is refused without the admin password", (await api(A, "/api/admin/feedback-csv")).status === 401);
const bad = await api(A, "/api/admin/login", { method: "POST", body: JSON.stringify({ password: "nope-nope" }) }); ok("wrong admin password is refused", bad.status === 401);
const same = await api(A, "/api/admin/login", { method: "POST", body: JSON.stringify({ password: process.env.TEST_PW }) }); ok("the site access password does NOT open the admin page", same.status === 401);
const good = await api(A, "/api/admin/login", { method: "POST", body: JSON.stringify({ password: process.env.ADMIN_PW }) }), adminCookie = good.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
ok("right admin password is accepted", good.status === 200 && /lb_admin=/.test(adminCookie));
const page = await (await fetch(B + "/admin", { headers: { cookie: `${A}; ${adminCookie}` } })).text();
ok("admin page shows by-day totals, up/down per feature and the thumbs-down list", /By day/.test(page) && /Thumbs up \/ down/.test(page) && /Thumbs-down feedback/.test(page) && /Needs the section 143/.test(page) && /dishonour of a cheque/i.test(page));
const csv = await fetch(B + "/api/admin/feedback-csv", { headers: { cookie: `${A}; ${adminCookie}` } }), raw = Buffer.from(await csv.arrayBuffer()), text = raw.toString("utf8").replace(/^\uFEFF/, "");
ok("CSV downloads with a header, my row, and quoted fields", csv.status === 200 && /text\/csv/.test(csv.headers.get("content-type")) && raw.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && text.startsWith("First vote,Last changed,Feature,Vote") && /Needs the section 143/.test(text), `${text.split("\r\n").length - 2} data row(s)`);
fs.writeFileSync("/tmp/w8-feedback-sample.csv", text);
console.log(`\n${rows.filter((x) => x[1] === "PASS").length}/${rows.length} passed`);
