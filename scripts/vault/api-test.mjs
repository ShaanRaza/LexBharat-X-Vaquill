// API-level tests for the Vault against a running dev server. usage: TEST_PW=<throwaway access password> node scripts/vault/api-test.mjs   (BASE defaults to http://localhost:3100)
// Reads .env.local only for the Supabase checks that look behind the API (rows and files really gone); prints no secrets.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, DIR = "../lexbharat-data/w6-test-files/";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = []; const ok = (name, pass, detail = "") => { rows.push([name, pass ? "PASS" : "FAIL", detail]); console.log(`${pass ? "PASS" : "FAIL"} | ${name}${detail ? " | " + detail : ""}`); };
const mode = process.argv[2] ?? "all";
// "A" is the browser that owns the documents; its cookie is kept between runs of the different modes
let A; if (mode === "all" || mode === "basic") { A = await login(); fs.writeFileSync("/tmp/w6-cookie.txt", A); } else A = fs.readFileSync("/tmp/w6-cookie.txt", "utf8");
const O = await login();
const api = (cookie, path, init = {}) => fetch(B + path, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } });
async function upload(cookie, file) {
  const buf = fs.readFileSync(DIR + file), r = await api(cookie, "/api/vault", { method: "POST", body: JSON.stringify({ name: file, size: buf.length }) }), j = await r.json();
  if (!r.ok) return { status: r.status, error: j.error };
  const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain" }), file);
  const put = await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  return { id: j.id, put: put.status };
}
async function settle(cookie, id, maxSteps = 60) {
  let steps = 0, t0 = Date.now();
  for (; steps < maxSteps; steps++) {
    const r = await api(cookie, `/api/vault/${id}/process`, { method: "POST" }), j = await r.json();
    if (r.status === 404) return { state: "gone", steps };
    if (["ready", "unreadable", "gone"].includes(j.state)) return { ...j, steps, secs: Math.round((Date.now() - t0) / 1000) };
    await sleep(Math.min(j.waitMs || 1000, 25000));
  }
  return { state: "timeout", steps };
}
const ids = {};
if (mode === "all" || mode === "basic") {
  // 1. good files
  for (const f of ["nda-test-contract.pdf", "nda-test-contract.docx", "notes.txt"]) {
    const u = await upload(A, f); ids[f] = u.id; const s = await settle(A, u.id);
    const d = s.doc;
    ok(`upload + process ${f}`, u.put === 200 && s.state === "ready" && d.chunkCount > 0 && d.embeddedCount === d.chunkCount, `state=${s.state}, pages=${d?.pages ?? "-"}, passages=${d?.chunkCount}, embedded=${d?.embeddedCount}, steps=${s.steps}, ${s.secs}s`);
  }
  // 2. unreadable files
  const sc = await upload(A, "scanned-image-only.pdf"), ss = await settle(A, sc.id);
  ok("scanned PDF shows the clear message", ss.state === "unreadable" && /scanned document\. Text reading for scans isn't available yet\./.test(ss.message), ss.message);
  const fk = await upload(A, "fake.pdf"), fs_ = await settle(A, fk.id);
  ok("a renamed non-PDF is refused", fs_.state === "unreadable" && /doesn't look like a real PDF/.test(fs_.message), fs_.message);
  const big = fs.statSync(DIR + "too-big.txt").size, r = await api(A, "/api/vault", { method: "POST", body: JSON.stringify({ name: "too-big.txt", size: big }) });
  ok("file over 10 MB is refused at the door", r.status === 422, (await r.json()).error);
  const r2 = await api(A, "/api/vault", { method: "POST", body: JSON.stringify({ name: "x.exe", size: 100 }) }); ok("unsupported type refused", r2.status === 422, (await r2.json()).error);
  const list = await (await api(A, "/api/vault")).json(); ok("list shows the statuses", list.docs.some((d) => d.status === "ready") && list.docs.some((d) => d.status === "unreadable"), list.docs.map((d) => `${d.name}:${d.status}`).join(", "));
  // rename + download
  const id = ids["notes.txt"]; const rn = await api(A, `/api/vault/${id}`, { method: "PATCH", body: JSON.stringify({ name: "renamed notes.txt" }) }); ok("rename", rn.status === 200 && (await (await api(A, `/api/vault/${id}`)).json()).doc.name === "renamed notes.txt");
  const dl = await (await api(A, `/api/vault/${id}/download`)).json(); const got = await fetch(dl.url); const txt = await got.text();
  ok("download through a signed link returns the file", got.status === 200 && txt.includes("45 days"), `expires in ${dl.expiresInSeconds}s`);
  const t0 = Date.now(); const wait = (dl.expiresInSeconds + 5) * 1000 - (Date.now() - t0); await sleep(wait);
  const late = await fetch(dl.url); ok("the signed link stops working after it expires", late.status >= 400, `status ${late.status} after ${dl.expiresInSeconds + 5}s`);
  fs.writeFileSync("/tmp/w6-ids.json", JSON.stringify({ ids, scanned: sc.id, fake: fk.id }));
}
if (mode === "all" || mode === "isolation") {
  const st = JSON.parse(fs.readFileSync("/tmp/w6-ids.json", "utf8")), victim = st.ids["nda-test-contract.pdf"];
  const spoof = { "x-lb-bid": "00000000-0000-4000-8000-000000000000" };
  const ol = await (await api(O, "/api/vault")).json(); ok("another browser's list is empty", ol.docs.length === 0, `docs=${ol.docs.length}`);
  for (const [n, path, init] of [["read", `/api/vault/${victim}`, {}], ["download", `/api/vault/${victim}/download`, {}], ["rename", `/api/vault/${victim}`, { method: "PATCH", body: JSON.stringify({ name: "hacked" }) }], ["process", `/api/vault/${victim}/process`, { method: "POST" }], ["delete", `/api/vault/${victim}`, { method: "DELETE" }]]) {
    const r = await api(O, path, init), r2 = await api(O, path, { ...init, headers: spoof });
    ok(`other browser cannot ${n} it (with and without a spoofed id header)`, r.status === 404 && r2.status === 404, `${r.status} / ${r2.status}`);
  }
  ok("the document is untouched after those attempts", (await (await api(A, `/api/vault/${victim}`)).json()).doc.name === "nda-test-contract.pdf");
  const nr = await api(O, "/api/vault/not-an-id"); ok("a malformed id is not found", nr.status === 404);
}
if (mode === "all" || mode === "delete") {
  const st = JSON.parse(fs.readFileSync("/tmp/w6-ids.json", "utf8")), id = st.ids["nda-test-contract.docx"];
  const before = { chunks: (await sb.from("vault_chunks").select("id", { count: "exact", head: true }).eq("doc_id", id)).count, vecs: (await sb.from("vault_chunks").select("id", { count: "exact", head: true }).eq("doc_id", id).not("embedding", "is", null)).count, text: (await sb.from("vault_texts").select("doc_id", { count: "exact", head: true }).eq("doc_id", id)).count };
  const row = (await sb.from("vault_documents").select("storage_key").eq("id", id).single()).data;
  const i = row.storage_key.lastIndexOf("/"), listBefore = (await sb.storage.from("Vault").list(row.storage_key.slice(0, i))).data.length;
  const r = await api(A, `/api/vault/${id}`, { method: "DELETE" });
  const after = { doc: (await sb.from("vault_documents").select("id", { count: "exact", head: true }).eq("id", id)).count, chunks: (await sb.from("vault_chunks").select("id", { count: "exact", head: true }).eq("doc_id", id)).count, text: (await sb.from("vault_texts").select("doc_id", { count: "exact", head: true }).eq("doc_id", id)).count };
  const listAfter = (await sb.storage.from("Vault").list(row.storage_key.slice(0, i))).data.length;
  ok("delete removes the file, record, text, passages and vectors", r.status === 200 && before.chunks > 0 && before.vecs === before.chunks && after.doc === 0 && after.chunks === 0 && after.text === 0 && listBefore === 1 && listAfter === 0, `before: ${before.chunks} passages / ${before.vecs} vectors / file ${listBefore}; after: record ${after.doc}, passages ${after.chunks}, text ${after.text}, file ${listAfter}`);
}
if (mode === "limits") {
  const made = [];
  for (let i = 0; i < 31; i++) { const r = await api(A, "/api/vault", { method: "POST", body: JSON.stringify({ name: `limit-${i}.txt`, size: 100 }) }), j = await r.json(); if (r.ok) made.push(j.id); else { ok("31st document is refused", i >= 30 || (await (await api(A, "/api/vault")).json()).docs.length >= 30, j.error); break; } }
  for (const id of made) await api(A, `/api/vault/${id}`, { method: "DELETE" });
  const ids2 = []; let lastErr = "";
  for (let i = 0; i < 11; i++) { const r = await api(A, "/api/vault", { method: "POST", body: JSON.stringify({ name: `big-${i}.pdf`, size: Math.round(9.9 * 1048576) }) }), j = await r.json(); if (r.ok) ids2.push(j.id); else { lastErr = j.error; break; } }
  ok("total size over 100 MB is refused", ids2.length === 10 && /100 MB/.test(lastErr), `${ids2.length} accepted; ${lastErr}`);
  for (const id of ids2) await api(A, `/api/vault/${id}`, { method: "DELETE" });
}
fs.writeFileSync("/tmp/w6-vault-" + mode + ".json", JSON.stringify(rows));
console.log(`\n${rows.filter((r) => r[1] === "PASS").length}/${rows.length} passed`);
