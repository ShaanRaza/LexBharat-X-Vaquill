// W10: one full Review end to end with a test contract against a running dev server. usage: TEST_PW=<throwaway access pw> node scripts/w10/review-e2e.mjs [file] [type] [side]
import { api, upload, settle } from "../w8/scan-test.mjs";
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const file = process.argv[2] ?? "maharashtra-leave-licence-test-contract.pdf", type = process.argv[3] ?? "rent", side = process.argv[4] ?? "Tenant / licensee";
const lg = await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) });
const cookie = lg.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const up = await upload(cookie, file, "../lexbharat-data/w6-test-files/"); console.log("upload", up.id ? "ok" : up);
const st = await settle(cookie, up.id); console.log("document", st.state, st.pages ?? "");
const rv = await (await api(cookie, "/api/review", { method: "POST", body: JSON.stringify({ docId: up.id, contractType: type, side }) })).json(); console.log("review id", rv.id ?? rv);
let run;
for (let i = 0; i < 60; i++) {
  const j = await (await api(cookie, `/api/review/${rv.id}/step`, { method: "POST", body: "{}" })).json(); run = j.run;
  if (!run || run.status !== "running") { const failed = run?.result?.parts?.some((p) => p.status === "failed") || run?.result?.law?.status === "failed"; if (!failed || i > 45) break; await sleep(65000); continue; }
  await sleep(1500);
}
const r = run?.result, clauses = r?.parts?.flatMap((p) => p.clauses ?? []) ?? [], law = r?.law;
console.log({ status: run?.status, clauses: clauses.length, risk: r?.risk, summary: r?.summary?.status, lawStatus: law?.status, findings: law?.findings?.length, dropped: law?.dropped });
console.log("law sources:", (law?.sources ?? []).map((s) => `${s.n}:${s.kind ?? "act"}:${s.actTitle.slice(0, 32)}`).join(" | "));
console.log("findings:", (law?.findings ?? []).slice(0, 6).map((f) => `${f.text.slice(0, 110)} [${(f.cites ?? f.sources ?? []).join(",")}]`).join("\n  "));
console.log("run url: /workspace/review/" + rv.id);
for (const f of ["docx", "pdf"]) { const e = await api(cookie, `/api/review/${rv.id}/export?format=${f}`); console.log("export", f, e.status); }
