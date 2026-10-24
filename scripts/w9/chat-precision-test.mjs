// Chat precision: a question that names an exact provision puts that unit first and keeps unrelated sources out of the prompt. usage: TEST_PW=<pw> node scripts/w9/chat-precision-test.mjs
import { api, login } from "../w8/scan-test.mjs";
const A = await login(), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const q of ["What is Order 7 Rule 11?", "What does Article 137 of the Limitation Act say?", "What does section 138 of the NI Act say?", "What does Article 21 say?"]) {
  let ev, err;
  for (let t = 0; t < 3; t++) { const res = await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message: q }) }); ev = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l)); err = ev.find((e) => e.type === "error"); if (!err || err.code !== "busy") break; await sleep(60000); }
  const src = ev.find((e) => e.type === "sources")?.sources ?? [], ans = ev.filter((e) => e.type === "delta").map((e) => e.text).join(""), chk = ev.find((e) => e.type === "check");
  console.log(`\nQ: ${q}\n   ${err ? "ERROR " + err.message : "answer check: " + chk?.label + (chk?.unsupported?.length ? ` (unsupported: ${chk.unsupported.length})` : "")}\n   ${src.length} sources: ${src.map((s) => `[${s.n}] ${s.actTitle.replace(/^The /, "").slice(0, 24)} ${s.number ?? ""}`).join("; ")}\n   answer: ${ans.replace(/\s+/g, " ").slice(0, 300)}`);
  await sleep(2500);
}
