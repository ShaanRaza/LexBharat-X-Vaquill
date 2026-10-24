// Thumbs on a draft and on a review, and the draft / review / upload counters. usage: TEST_PW=<pw> node scripts/w8/feedback-test-more.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { api, login, settle, upload } from "./scan-test.mjs";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const counter = async (metric, key) => { let q = sb.from("usage_daily").select("n,key").eq("day", today()).eq("metric", metric); if (key !== undefined) q = q.eq("key", key); return ((await q).data ?? []).reduce((a, r) => a + Number(r.n), 0); };
const A = await login(), tpl = fs.readdirSync("content/templates").filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))[0];
const post = (b) => api(A, "/api/feedback", { method: "POST", body: JSON.stringify(b) });
// review: made (no model call needed), then rated
const up0 = await counter("upload"), rv0 = await counter("review");
const u = await upload(A, "nda-test-contract.pdf", "../lexbharat-data/w6-test-files/"); await sleep(500);
console.log("upload counted:", (await counter("upload")) === up0 + 1 ? "yes (once)" : "NO", `(${up0} -> ${await counter("upload")})`);
const s = await settle(A, u.id);
const rv = await (await api(A, "/api/review", { method: "POST", body: JSON.stringify({ docId: u.id, contractType: "nda", side: "Receiving party" }) })).json(); await sleep(500);
console.log("review counted:", (await counter("review")) === rv0 + 1 ? "yes (once)" : "NO", `(${rv0} -> ${await counter("review")})`);
let r = await post({ feature: "review", itemId: rv.id, vote: "down", reasons: ["Missing law"], comment: "Did not cite s.27." }); console.log("review thumbs down:", r.status);
const rvRow = (await sb.from("feedback").select("vote,snapshot,model").eq("item_id", rv.id)).data?.[0]; console.log("  stored:", JSON.stringify(rvRow));
// draft
const d0 = await counter("draft", tpl);
const g = await api(A, "/api/drafting/generate", { method: "POST", body: JSON.stringify({ templateId: tpl, values: {}, allowMissing: true }) });
const ev = (await g.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)), saved = ev.find((e) => e.type === "saved"), err = ev.find((e) => e.type === "error");
if (!saved) console.log("draft not generated:", err?.message ?? g.status);
else {
  await sleep(800); console.log(`draft counted for template ${tpl}:`, (await counter("draft", tpl)) === d0 + 1 ? "yes (once)" : "NO");
  r = await post({ feature: "draft", itemId: saved.draftId, vote: "up" }); console.log("draft thumbs up:", r.status);
  console.log("  stored:", JSON.stringify((await sb.from("feedback").select("vote,snapshot,model").eq("item_id", saved.draftId)).data?.[0]));
}
console.log("(each counter above is one per action: re-voting never adds to them)");
