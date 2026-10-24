// Processing resume test: starts reading a long text file, "closes the tab" after the first embedding batch, then continues from the stored state. usage: TEST_PW=... node scripts/vault/resume-test.mjs
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const B = "http://localhost:3100", sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.TEST_PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const cookie = await login(), api = (p, i = {}) => fetch(B + p, { ...i, headers: { cookie, "content-type": "application/json" } });
const body = Array.from({ length: 60 }, (_, i) => `${i + 1}. Clause ${i + 1}\nThe parties agree that obligation number ${i + 1} applies during the term of this fictional agreement and survives termination for the period stated. `.repeat(2)).join("\n");
const buf = Buffer.from(body), j = await (await api("/api/vault", { method: "POST", body: JSON.stringify({ name: "long-resume-test.txt", size: buf.length }) })).json();
const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: "text/plain" }), "long.txt"); await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
const step = async () => (await (await api(`/api/vault/${j.id}/process`, { method: "POST" })).json());
const state = async () => (await sb.from("vault_documents").select("status,chunk_count,embedded_count").eq("id", j.id).single()).data;
console.log("text length", buf.length);
let s = await step(); console.log("step 1:", s.state, "chunks", s.doc?.chunkCount);
s = await step(); console.log("step 2:", s.state, `embedded ${s.doc?.embeddedCount}/${s.doc?.chunkCount}`);
const mid = await state(); console.log("-- tab closed here; stored state:", JSON.stringify(mid));
await sleep(3000);
let n = 0; for (;;) { s = await step(); n++; if (s.state === "ready" || n > 12) break; await sleep(Math.min(s.waitMs || 1000, 25000)); }
const end = await state(); const vecs = (await sb.from("vault_chunks").select("id", { count: "exact", head: true }).eq("doc_id", j.id).not("embedding", "is", null)).count;
console.log("resumed:", s.state, "in", n, "more steps; stored state:", JSON.stringify(end), "vectors", vecs);
console.log(mid.status === "processing" && mid.embedded_count > 0 && mid.embedded_count < mid.chunk_count && end.status === "ready" && end.embedded_count === end.chunk_count && vecs === end.chunk_count ? "PASS | processing resumes from the stored state" : "FAIL | resume");
await api(`/api/vault/${j.id}`, { method: "DELETE" });
