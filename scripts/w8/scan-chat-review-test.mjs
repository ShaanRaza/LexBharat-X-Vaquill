// Chat and Review on a mixed PDF (page 2 is a scan): are page numbers kept, and is "read from scan" shown? usage: TEST_PW=<pw> node scripts/w8/scan-chat-review-test.mjs
import { api, login, settle, upload } from "./scan-test.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const A = await login(), u = await upload(A, "mixed-text-and-scan.pdf"), s = await settle(A, u.id);
console.log("mixed document:", s.state, "scan pages:", JSON.stringify((await (await api(A, `/api/vault/${u.id}`)).json()).scanPages));
// chat
const res = await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message: "Can a party assign this agreement to someone else without the other party's consent?", docIds: [u.id] }) });
const lines = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)), srcs = lines.find((e) => e.type === "sources")?.sources ?? [], answer = lines.filter((e) => e.type === "delta").map((e) => e.text).join(""), done = lines.find((e) => e.type === "done"), err = lines.find((e) => e.type === "error");
console.log("chat:", err ? `ERROR ${err.message}` : "answered", "| message id", done?.messageId);
for (const c of srcs.filter((x) => x.kind === "doc")) console.log(`  [${c.n}] ${c.docName} page ${c.page} scan=${!!c.scan} | ${String(c.preview ?? "").slice(0, 70)}`);
console.log("  answer:", answer.replace(/\s+/g, " ").slice(0, 400));
// review
const cr = await (await api(A, "/api/review", { method: "POST", body: JSON.stringify({ docId: u.id, contractType: "nda", side: "Receiving party" }) })).json();
if (!cr.id) { console.log("review could not start:", cr.error); process.exit(0); }
let run; for (let i = 0; i < 30; i++) { const j = await (await api(A, `/api/review/${cr.id}/step`, { method: "POST", body: "{}" })).json(); run = j.run; if (!run || run.status !== "running") break; await sleep(1500); }
console.log("review:", run?.status, "| scanPages in result:", JSON.stringify(run?.result?.scanPages));
for (const p of run?.result?.parts ?? []) for (const c of p.clauses ?? []) console.log(`  ${c.ref} | risk ${c.risk} | page ${c.page} | scan=${!!c.scan}`);
