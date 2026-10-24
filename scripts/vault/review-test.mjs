// Reviews the three fictional test contracts (PDF and DOCX) against a running dev server and checks what the review flagged. usage: TEST_PW=<throwaway password> node scripts/vault/review-test.mjs [file ...]
// Each file uses a fresh browser id (so the 5-a-day limit is not hit). Output: a table of hits and misses; the full results go to /tmp/w6-review-<file>.json.
import fs from "node:fs";
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, DIR = "../lexbharat-data/w6-test-files/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = async () => (await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: PW }) })).headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", txt: "text/plain" };
const CASES = {
  "nda-test-contract": { type: "nda", side: "Receiving party", checks: [
    ["flags the 5-year all-India non-compete (clause 4)", (R) => R.clauses.some((c) => /^4/.test(c.ref) && c.risk !== "acceptable")],
    ["cites Indian Contract Act s.27 (restraint of trade)", (R) => R.cites("Indian Contract Act", "27")],
    ["flags the Rs 50 lakh penalty (clause 5)", (R) => R.clauses.some((c) => /^5/.test(c.ref) && c.risk !== "acceptable")],
    ["cites Indian Contract Act s.74 (penalty)", (R) => R.cites("Indian Contract Act", "74")]] },
  "service-agreement-test-contract": { type: "service", side: "Vendor / service provider", checks: [
    ["flags unlimited liability (clause 5)", (R) => R.clauses.some((c) => /^5/.test(c.ref) && c.risk !== "acceptable")],
    ["flags the English governing law / London courts (clause 7)", (R) => R.clauses.some((c) => /^7/.test(c.ref) && c.risk !== "acceptable")],
    ["a law point on the foreign law/courts or on damages is cited", (R) => R.cites("Indian Contract Act", "28") || R.cites("Indian Contract Act", "73")],
    ["lists a missing liability cap", (R) => R.missing.some((m) => /liab|cap/i.test(m.clause))]] },
  "maharashtra-leave-licence-test-contract": { type: "rent", side: "Tenant / licensee", checks: [
    ["lists the missing registration clause", (R) => R.missing.some((m) => /regist/i.test(m.clause))],
    ["lists the missing stamp duty clause", (R) => R.missing.some((m) => /stamp/i.test(m.clause))],
    ["cites Registration Act s.17", (R) => R.cites("Registration Act", "17")],
    ["cites Maharashtra Stamp Act or Rent Control Act", (R) => R.cites("Maharashtra Stamp Act", null) || R.cites("Maharashtra Rent Control Act", null)]] },
};
const files = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CASES).flatMap((n) => [`${n}.pdf`, `${n}.docx`]);
const out = [];
for (const file of files) {
  const base = file.replace(/\.(pdf|docx)$/, ""), ext = file.split(".").pop(), C = CASES[base], cookie = await login();
  const api = (path, init = {}) => fetch(B + path, { ...init, headers: { cookie, "content-type": "application/json" } });
  const buf = fs.readFileSync(DIR + file), up = await (await api("/api/vault", { method: "POST", body: JSON.stringify({ name: file, size: buf.length }) })).json();
  const fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", new Blob([buf], { type: MIME[ext] }), file); await fetch(up.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  for (let i = 0; i < 40; i++) { const j = await (await api(`/api/vault/${up.id}/process`, { method: "POST" })).json(); if (["ready", "unreadable"].includes(j.state)) break; await sleep(Math.min(j.waitMs || 1000, 25000)); }
  const t0 = Date.now(), cr = await api("/api/review", { method: "POST", body: JSON.stringify({ docId: up.id, contractType: C.type, side: C.side }) }), cj = await cr.json();
  if (!cr.ok) { console.log(`${file}: could not start: ${cj.error}`); continue; }
  let run, steps = 0;
  for (; steps < 30; steps++) { const j = await (await api(`/api/review/${cj.id}/step`, { method: "POST", body: "{}" })).json(); run = j.run; if (!run || run.status !== "running") break; await sleep(500); }
  // like the page does: a unit that failed only because the free model was busy is retried (twice, after a pause)
  const tries = {};
  for (;;) {
    const r0 = run.result, b = r0.parts.find((p) => p.status === "failed" && /busy|could not be (?:prepared|reviewed|read)/i.test(p.error ?? ""))?.i ?? (r0.summary.status === "failed" && /busy|could not be (?:prepared|reviewed|read)/i.test(r0.summary.error ?? "") ? "summary" : r0.law.status === "failed" && /busy|could not be (?:prepared|reviewed|read)/i.test(r0.law.error ?? "") ? "law" : undefined);
    if (b === undefined || (tries[b] = (tries[b] ?? 0) + 1) > 2) break;
    await sleep(22000); let more = { retry: b };
    for (; steps < 60; steps++) { const j = await (await api(`/api/review/${cj.id}/step`, { method: "POST", body: JSON.stringify(more) })).json(); more = {}; run = j.run; if (!run || run.status !== "running") break; await sleep(500); }
  }
  const res = run.result, clauses = res.parts.flatMap((p) => p.clauses ?? []), src = res.law.sources ?? [], findings = res.law.findings ?? [];
  const R = { clauses, missing: res.missing, cites: (act, num) => findings.some((f) => f.cites.some((n) => { const s = src.find((x) => x.n === n); return s && s.actTitle.toLowerCase().includes(act.toLowerCase()) && (num === null || String(s.number).toUpperCase() === num); })) };
  const rows = C.checks.map(([name, fn]) => [name, fn(R)]);
  console.log(`\n=== ${file} | status=${run.status} | ${steps + 1} steps | ${Math.round((Date.now() - t0) / 1000)}s | risk=${res.risk} | parts ${res.parts.map((p) => p.status).join(",")} summary=${res.summary.status} law=${res.law.status} | models ${res.models.join(", ")}`);
  for (const [n, ok] of rows) console.log(`${ok ? "HIT " : "MISS"} | ${n}`);
  console.log(`clauses: ${clauses.map((c) => `${c.ref}:${c.risk[0]}`).join(" ")} | missing: ${res.missing.map((m) => m.clause).join("; ")}`);
  console.log(`law points: ${findings.map((f) => `${f.topic} [${f.cites.map((n) => { const s = src.find((x) => x.n === n); return s ? `${s.actTitle.replace(/^The /, "").split(",")[0]} s${s.number}` : n; }).join("; ")}]`).join(" | ")} (dropped ${res.law.dropped ?? 0})`);
  // the exports open and carry the review
  const { execFileSync } = await import("node:child_process"); let exp = [];
  for (const f of ["docx", "pdf"]) { const r = await api(`/api/review/${cj.id}/export?format=${f}`), b = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(`/tmp/w6-export-${base}-${ext}.${f}`, b);
    const text = f === "pdf" ? execFileSync("pdftotext", [`/tmp/w6-export-${base}-${ext}.pdf`, "-"]).toString() : execFileSync("textutil", ["-convert", "txt", "-stdout", `/tmp/w6-export-${base}-${ext}.docx`]).toString();
    exp.push(`${f}: ${r.status} ${b.length}B, text ${text.length} chars, ${/Not legal advice/.test(text) ? "has the disclaimer" : "NO disclaimer"}, ${/Suggested changes/.test(text) && /Indian law points/.test(text) ? "all sections" : "SECTIONS MISSING"}`); }
  console.log("exports: " + exp.join(" | "));
  fs.writeFileSync(`/tmp/w6-review-${file}.json`, JSON.stringify({ run, id: cj.id, checks: rows }, null, 1)); out.push({ file, rows });
}
fs.writeFileSync("/tmp/w6-review-summary.json", JSON.stringify(out));
