// Creates the data the Phase 2 screenshots need, once, under a FIXED browser id so every run sees the same chat, draft, Vault document and Review:
//   a Chat answer with citations, a Drafting document, a Vault document, a Review result. Ids are written to ../lexbharat-data/reskin-fixtures.json.
// usage: ACCESS_PW=... node --experimental-websocket qa/reskin/fixtures.mjs [base=http://localhost:3100]
import fs from "node:fs";
const BASE = process.argv[2] ?? "http://localhost:3100", BID = "reskinfixtures00000000001", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lg = await fetch(BASE + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ACCESS_PW }) });
const cookie = lg.headers.getSetCookie().map((c) => c.split(";")[0]).concat(`lb_bid=${BID}`).join("; ");
const api = (p, init = {}) => fetch(BASE + p, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers ?? {}) } });
const ndjson = async (r) => (await r.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
const out = fs.existsSync("../lexbharat-data/reskin-fixtures.json") ? JSON.parse(fs.readFileSync("../lexbharat-data/reskin-fixtures.json", "utf8")) : {};
const save = () => fs.writeFileSync("../lexbharat-data/reskin-fixtures.json", JSON.stringify(out, null, 1));
if (!out.chat) {
  const ev = await ndjson(await api("/api/chat", { method: "POST", body: JSON.stringify({ message: "What does section 138 of the Negotiable Instruments Act say, and within what time must the complaint be filed?" }) }));
  out.chat = ev.find((e) => e.type === "start")?.chatId; console.log("chat", out.chat, ev.some((e) => e.type === "error") ? "ERROR" : "ok"); save();
}
if (!out.draft) {
  const t = JSON.parse(fs.readFileSync("src/content/templates.generated.json", "utf8")); const id = (Array.isArray(t) ? t[0] : Object.values(t)[0]).id ?? Object.keys(t)[0];
  const ev = await ndjson(await api("/api/drafting/generate", { method: "POST", body: JSON.stringify({ templateId: id, values: {}, allowMissing: true }) }));
  out.draft = ev.find((e) => e.type === "saved")?.draftId; console.log("draft", out.draft); save();
}
if (!out.vault) {
  const name = "nda-test-contract.pdf", buf = fs.readFileSync("../lexbharat-data/w6-test-files/" + name);
  const j = await (await api("/api/vault", { method: "POST", body: JSON.stringify({ name, size: buf.length }) })).json();
  const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: "application/pdf" }), name);
  await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  for (let i = 0; i < 80; i++) { const st = await (await api(`/api/vault/${j.id}/process`, { method: "POST" })).json(); if (["ready", "unreadable"].includes(st.state)) break; await sleep(Math.min(st.waitMs || 800, 8000)); }
  out.vault = j.id; console.log("vault", out.vault); save();
}
if (!out.review && out.vault) {
  const rv = await (await api("/api/review", { method: "POST", body: JSON.stringify({ docId: out.vault, contractType: "nda", side: "Receiving party" }) })).json();
  for (let i = 0; i < 60; i++) { const r = await (await api(`/api/review/${rv.id}/step`, { method: "POST", body: "{}" })).json(); if (!r.run || r.run.status !== "running") break; await sleep(1500); }
  out.review = rv.id; console.log("review", out.review); save();
}
console.log(out);
