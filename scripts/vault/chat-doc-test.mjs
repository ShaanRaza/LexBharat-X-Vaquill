// Chat with an attached Vault document, against a running dev server. usage: TEST_PW=... node scripts/vault/chat-doc-test.mjs [file] "question 1" "question 2" ...
import fs from "node:fs";
const B = "http://localhost:3100", DIR = "../lexbharat-data/w6-test-files/", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const [file, ...qs] = process.argv.slice(2);
const cookie = (await (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.TEST_PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; "));
const api = (p, i = {}) => fetch(B + p, { ...i, headers: { cookie, "content-type": "application/json" } });
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };
const buf = fs.readFileSync(DIR + file), up = await (await api("/api/vault", { method: "POST", body: JSON.stringify({ name: file, size: buf.length }) })).json();
const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: MIME[file.split(".").pop()] }), file); await fetch(up.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
for (let i = 0; i < 40; i++) { const j = await (await api(`/api/vault/${up.id}/process`, { method: "POST" })).json(); if (["ready", "unreadable"].includes(j.state)) break; await sleep(Math.min(j.waitMs || 1000, 25000)); }
const results = [];
for (const q of qs) {
  const t0 = Date.now(), res = await api("/api/chat", { method: "POST", body: JSON.stringify({ message: q, docIds: [up.id] }) });
  if (!res.ok) { console.log(q, "->", res.status, (await res.json()).error); continue; }
  let text = "", sources = [], check = null, notes = [];
  const reader = res.body.getReader(), dec = new TextDecoder(); let buf2 = "";
  for (;;) { const { value, done } = await reader.read(); buf2 += dec.decode(value ?? new Uint8Array(), { stream: !done }); let i; while ((i = buf2.indexOf("\n")) >= 0) { const l = buf2.slice(0, i).trim(); buf2 = buf2.slice(i + 1); if (!l) continue; const e = JSON.parse(l); if (e.type === "delta") text += e.text; else if (e.type === "replace") text = e.text; else if (e.type === "sources") sources = e.sources; else if (e.type === "check") check = e; else if (e.type === "note") notes.push(e.text); else if (e.type === "error") text += `[ERROR ${e.message}]`; } if (done) break; }
  const cited = [...new Set([...text.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(",").map((x) => Number(x))))];
  console.log(`\nQ: ${q}  (${Math.round((Date.now() - t0) / 1000)}s)\n${text}\n--- label: ${check?.label} | sources: ${sources.map((s) => `${s.n}:${s.kind === "doc" ? `DOC ${s.docName} p${s.page ?? "-"} ${s.label ?? ""}` : `${s.actTitle.replace(/^The /, "").split(",")[0]} s${s.number}`}`).join(" | ")} | cited: ${cited.join(",")} | notes: ${notes.join(" / ")}`);
  results.push({ q, text, label: check?.label, sources, cited });
}
fs.writeFileSync(`/tmp/w6-chat-${file}.json`, JSON.stringify(results, null, 1));
await api(`/api/vault/${up.id}`, { method: "DELETE" });
