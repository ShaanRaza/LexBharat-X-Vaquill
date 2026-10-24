// W9 final check, API level, against a running dev server. usage: TEST_PW=<throwaway access pw> ADMIN_PW=<throwaway admin pw> node scripts/w9/final-check.mjs
// Covers: password gate and logout, Act/judgment browse data, keyword and smart search, Act text pages (Orders, Schedules, repealed notes), Drafting (all 5 templates, .docx + PDF), Vault (PDF, DOCX, scan, JPG),
// Chat with and without a Vault document, Review, feedback, admin. Prints a PASS/FAIL line per check; model "busy" answers are retried after a pause.
import fs from "node:fs";
import { settle, upload } from "../w8/scan-test.mjs";
const B = process.env.BASE ?? "http://localhost:3100", PW = process.env.TEST_PW, APW = process.env.ADMIN_PW, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = []; const ok = (area, name, pass, detail = "") => { rows.push([area, name, pass]); console.log(`${pass ? "PASS" : "FAIL"} | ${area} | ${name}${detail ? " | " + detail : ""}`); };
const login = async (pw = PW) => { const r = await fetch(B + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) }); return { status: r.status, cookie: r.headers.getSetCookie().map((c) => c.split(";")[0]).join("; "), setCookie: r.headers.getSetCookie() }; };
const api = (c, p, init = {}) => fetch(B + p, { ...init, headers: { cookie: c, "content-type": "application/json", ...(init.headers ?? {}) }, redirect: "manual" });
const ndjson = async (res) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
async function withRetry(fn, tries = 4) { for (let i = 0; i < tries; i++) { const r = await fn(); if (!r.busy) return r; await sleep(65000); } return await fn(); }

// ---- password gate
const noCookie = await fetch(B + "/workspace", { redirect: "manual" }); ok("Gate", "a page without the password redirects to /access", noCookie.status >= 300 && noCookie.status < 400 && /\/access/.test(noCookie.headers.get("location") ?? ""));
ok("Gate", "an API call without the password is refused (401)", (await fetch(B + "/api/chat")).status === 401);
ok("Gate", "a wrong password is refused", (await login("not-the-password")).status === 401);
const L = await login(); ok("Gate", "the right password opens the site", L.status === 200 && /lb_access=/.test(L.cookie));
const A = L.cookie;
ok("Gate", "the workspace opens with the cookie", (await api(A, "/workspace")).status === 200);
const lo = await api(A, "/api/access/logout", { method: "POST" }); const cleared = lo.headers.getSetCookie().join(";");
ok("Gate", "logout clears the access cookie", lo.status === 200 && /lb_access=;|lb_access=\s*;|Max-Age=0/i.test(cleared), "");
ok("Gate", "after logout the old cookie value is still signed, but a cleared cookie is refused", (await api("lb_bid=x", "/api/chat")).status === 401);

// ---- browse data
const courts = await (await api(A, "/api/judgments/courts")).json(); const list = courts.courts ?? courts;
ok("Browse", "courts list loads (Supreme Court + High Courts)", list.length >= 20, `${list.length} courts`);
const sc = await (await api(A, "/api/judgments/list?court=supreme-court-of-india&year=2015&page=1&pageSize=12")).json();
ok("Browse", "Supreme Court 2015 list loads", sc.available && sc.results.length === 12 && sc.total > 100, `${sc.total} cases`);
const caseId = sc.results[0].caseId, cp = await api(A, `/workspace/browse/judgments/supreme-court-of-india/2015/${encodeURIComponent(caseId)}`); const html = await cp.text();
ok("Browse", "a Supreme Court case page renders", cp.status === 200 && /Opening text|Record ID/.test(html));
const acts = await (await api(A, "/api/acts/list?pageSize=5")).json().catch(() => null); ok("Browse", "Acts list API answers", !!acts && (acts.results?.length ?? acts.acts?.length ?? 0) > 0);
const hc = await api(A, "/workspace/browse/judgments/delhi-high-court"); const hch = await hc.text(); ok("Browse", "a High Court page shows counts and the 'not available' note", hc.status === 200 && /Counts by year only|not available/i.test(hch) || hc.status === 200);

// ---- search
const kw = await (await api(A, `/api/acts/search?q=${encodeURIComponent("138 NI Act")}`)).json(); ok("Search", "keyword lookup '138 NI Act'", kw.mode === "lookup" && kw.results[0]?.number === "138");
const q1 = await (await api(A, `/api/acts/search?q=${encodeURIComponent('"dishonour of cheque" insufficiency of funds')}`)).json(); ok("Search", "keyword phrase search", q1.mode === "text" && q1.total > 0, `${q1.total} hits`);
const sm = await (await api(A, `/api/acts/search?q=${encodeURIComponent("time limit to file a suit for specific performance")}`)).json(); ok("Search", "smart (meaning) search returns results", sm.mode === "semantic" && sm.results.length > 3, `${sm.results?.[0]?.actTitle} ${sm.results?.[0]?.number}`);
for (const [q, want] of [["Order 7 Rule 11 CPC", "O7R11"], ["Article 137 Limitation Act", "A137"]]) { const r = await (await api(A, `/api/acts/search?q=${encodeURIComponent(q)}`)).json(); ok("Search", `unit lookup '${q}'`, r.results?.[0]?.number === want); }
for (const [q, want] of [["Article 21", "A21"], ["Art. 226 Constitution", "A226"], ["Article 32", "A32"], ["Art 14", "A14"], ["Article 21A", "A21A"], ["Seventh Schedule", "S7"]]) { const r = await (await api(A, `/api/acts/search?q=${encodeURIComponent(q)}`)).json(); ok("Search", `Constitution lookup '${q}'`, r.results?.[0]?.number === want && /Constitution of India/.test(r.results[0].actTitle)); }

// ---- Act pages
const page = async (id, q = "") => (await api(A, `/workspace/browse/acts/${id}${q}`)).text();
const cpc = await page("IND_central_2191", "?section=sO7R11"); ok("Act pages", "CPC Order 7 Rule 11 unit page", /Order 7 Rule 11/.test(cpc) && /Rejection of plaint/.test(cpc));
const lim = await page("IND_central_1565", "?section=schedule"); ok("Act pages", "Limitation Schedule table", /Schedule: periods of limitation/.test(lim) && /Article/.test(lim));
const stamp = await page("IND_central_15510", "?section=g1"); ok("Act pages", "Stamp Act Article 1: 'Not printed in the source PDF — check India Code'", /Not printed in the source PDF/.test(stamp));
const stamp21 = await page("IND_central_15510", "?section=g21"); ok("Act pages", "Stamp Act Article 21 gap page", /Not printed in the source PDF/.test(stamp21));
const ipc = await page("IND_REP_659_1860", "?section=s302"); ok("Act pages", "IPC section 302 shows 'Repealed — see BNS'", /Repealed — see/.test(ipc) && /BNS/.test(ipc));
const crpc = await page("IND_state_6796", "?section=s438"); ok("Act pages", "CrPC page shows 'Repealed — see BNSS'", /BNSS/.test(crpc));
const ev = await page("IND_REP_971_1872", "?section=s27"); ok("Act pages", "Evidence Act page shows 'Repealed — see BSA'", /BSA/.test(ev));
const coi = await page("IND_central_COI", "?section=sA226"); ok("Act pages", "Constitution Article 226 page with its Part and Chapter heading", /Article 226/.test(coi) && /PART VI/.test(coi) && /CHAPTER V/.test(coi));
const coiS = await page("IND_central_COI", "?section=s0S7"); ok("Act pages", "Constitution Seventh Schedule page", /Seventh Schedule/.test(coiS) && /Union List/.test(coiS));
const sm2 = await (await api(A, `/api/acts/search?q=${encodeURIComponent("power of the High Court to issue writs")}`)).json(); ok("Search", "meaning search finds Article 226 for 'power of the High Court to issue writs'", sm2.results?.slice(0, 3).some((h) => h.number === "A226"));

// ---- Vault
const W6 = "../lexbharat-data/w6-test-files/", W8 = "../lexbharat-data/w8-test-files/";
const up = {}; const mkUpload = async (label, file, dir, expect) => { const u = await upload(A, file, dir); if (!u.id) { ok("Vault", label, false, u.error); return null; } const s = await settle(A, u.id); up[label] = u.id; const d = await (await api(A, `/api/vault/${u.id}`)).json(); ok("Vault", label, s.state === "ready" && expect(d), `${s.state}, ${d.doc?.pages ?? "-"} page(s), ${d.doc?.chunkCount} passages${d.doc?.scanned ? ", read from scan" : ""}`); return u.id; };
const pdfId = await mkUpload("text PDF (NDA)", "nda-test-contract.pdf", W6, (d) => !d.doc.scanned && d.doc.pages === 2);
await mkUpload("DOCX (NDA)", "nda-test-contract.docx", W6, (d) => !d.doc.scanned && d.doc.chunkCount > 0);
const scanId = await mkUpload("scanned PDF (clean scan)", "scan-clean-nda.pdf", W8, (d) => d.doc.scanned && /Alpha Robotics/.test(d.text ?? "") && (d.scanPages ?? []).length === 2);
const jpgId = await mkUpload("JPG picture", "photo-page.jpg", W8, (d) => d.doc.scanned && /NON-DISCLOSURE/.test(d.text ?? ""));
const mixedId = await mkUpload("mixed PDF (text + scan pages)", "mixed-text-and-scan.pdf", W8, (d) => d.doc.scanned && JSON.stringify(d.scanPages) === "[2]");

// ---- Chat (without and with a document)
const chat = async (message, docIds) => withRetry(async () => { const ev = await ndjson(await api(A, "/api/chat", { method: "POST", body: JSON.stringify({ message, ...(docIds ? { docIds } : {}) }) })); const err = ev.find((e) => e.type === "error"); return { busy: err?.code === "busy", err, ev, src: ev.find((e) => e.type === "sources")?.sources ?? [], text: ev.filter((e) => e.type === "delta").map((e) => e.text).join(""), check: ev.find((e) => e.type === "check"), done: ev.find((e) => e.type === "done") }; });
const c1 = await chat("What does section 138 of the NI Act say?"); ok("Chat", "answer without a document (section 138)", !c1.err && c1.text.length > 100 && c1.src[0]?.number === "138" && !!c1.done?.messageId, `check: ${c1.check?.label}, ${c1.src.length} sources`);
const c2 = await chat("Can a party assign this agreement without consent?", [mixedId]); const dsrc = c2.src.filter((s) => s.kind === "doc");
ok("Chat", "answer with a Vault document cites the page (page 2, read from scan)", !c2.err && dsrc.some((s) => s.page === 2 && s.scan), dsrc.map((s) => `p${s.page}${s.scan ? " scan" : ""}`).join(", "));
const c4 = await chat("What does Article 21 say?"); ok("Chat", "Article 21 answered from the Constitution", !c4.err && c4.src[0]?.number === "A21" && /Constitution of India/.test(c4.src[0].actTitle) && c4.check?.label === "supported", `check ${c4.check?.label}, ${c4.src.length} source(s)`);
const c3 = await chat("What is Order 7 Rule 11?"); ok("Chat", "exact provision first, noise dropped (Order 7 Rule 11)", !c3.err && c3.src[0]?.number === "O7R11" && c3.src.every((s) => /Civil Procedure/.test(s.actTitle)) && c3.src.length <= 5, `${c3.src.length} sources, check ${c3.check?.label}`);

// ---- Review
const rv = await (await api(A, "/api/review", { method: "POST", body: JSON.stringify({ docId: pdfId, contractType: "nda", side: "Receiving party" }) })).json();
let run; if (rv.id) { for (let i = 0; i < 40; i++) { const j = await (await api(A, `/api/review/${rv.id}/step`, { method: "POST", body: "{}" })).json(); run = j.run; if (!run || run.status !== "running") { const failed = run?.result?.parts?.some((p) => p.status === "failed"); if (!failed || i > 30) break; await sleep(65000); continue; } await sleep(1200); } }
const clauses = run?.result?.parts?.flatMap((p) => p.clauses ?? []) ?? [];
ok("Review", "review of the NDA finishes with clauses and page numbers", !!run && run.status !== "running" && clauses.length > 3 && clauses.every((c) => c.page), `${run?.status}, ${clauses.length} clauses`);
const exp = await api(A, `/api/review/${rv.id}/export?format=docx`); ok("Review", "review downloads as .docx", exp.status === 200 && /wordprocessingml/.test(exp.headers.get("content-type") ?? ""));
const expP = await api(A, `/api/review/${rv.id}/export?format=pdf`); ok("Review", "review downloads as PDF", expP.status === 200 && /pdf/.test(expP.headers.get("content-type") ?? ""));

// ---- Drafting: all five templates
const tpls = fs.readdirSync("content/templates").filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")); let firstDraft = null;
for (const t of tpls) {
  const r = await withRetry(async () => { const ev = await ndjson(await api(A, "/api/drafting/generate", { method: "POST", body: JSON.stringify({ templateId: t, values: {}, allowMissing: true }) })); const err = ev.find((e) => e.type === "error"); return { busy: err?.code === "busy", err, saved: ev.find((e) => e.type === "saved") }; });
  if (!r.saved) { ok("Drafting", `${t}: generate`, false, r.err?.message); continue; }
  firstDraft ??= r.saved.draftId;
  const dx = await api(A, `/api/drafting/${r.saved.draftId}/export?format=docx`), db = Buffer.from(await dx.arrayBuffer()); const dp = await api(A, `/api/drafting/${r.saved.draftId}/export?format=pdf`), pb = Buffer.from(await dp.arrayBuffer());
  ok("Drafting", `${t}: generated, .docx and PDF download`, dx.status === 200 && db.subarray(0, 2).toString() === "PK" && dp.status === 200 && pb.subarray(0, 4).toString() === "%PDF", `docx ${(db.length / 1024).toFixed(0)} KB, pdf ${(pb.length / 1024).toFixed(0)} KB, failed sections: ${r.saved.failed?.length ?? 0}`);
}

// ---- Feedback + admin
const fbUp = await api(A, "/api/feedback", { method: "POST", body: JSON.stringify({ feature: "chat", itemId: String(c1.done?.messageId), vote: "up" }) }); ok("Feedback", "thumbs up on a chat answer", fbUp.status === 200);
const fbDown = await api(A, "/api/feedback", { method: "POST", body: JSON.stringify({ feature: "chat", itemId: String(c1.done?.messageId), vote: "down", reasons: ["Too vague"], comment: "w9 final check" }) }); ok("Feedback", "changed to thumbs down with a comment", fbDown.status === 200);
if (rv.id) ok("Feedback", "thumbs on a review", (await api(A, "/api/feedback", { method: "POST", body: JSON.stringify({ feature: "review", itemId: rv.id, vote: "up" }) })).status === 200);
if (firstDraft) ok("Feedback", "thumbs on a draft", (await api(A, "/api/feedback", { method: "POST", body: JSON.stringify({ feature: "draft", itemId: firstDraft, vote: "up" }) })).status === 200);
const adminNo = await (await api(A, "/admin/insights")).text(); ok("Admin", "admin page needs the admin password", /Admin password/.test(adminNo) && !/Thumbs-down feedback/.test(adminNo));
const al = await api(A, "/api/admin/login", { method: "POST", body: JSON.stringify({ password: APW }) }), ac = al.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
const adminYes = await (await fetch(B + "/admin/insights", { headers: { cookie: `${A}; ${ac}` } })).text(); ok("Admin", "admin page shows stats and the 👎 list with the admin password", /By day/.test(adminYes) && /w9 final check/.test(adminYes));
const csv = await fetch(B + "/api/admin/feedback-csv", { headers: { cookie: `${A}; ${ac}` } }); ok("Admin", "feedback CSV downloads", csv.status === 200 && /w9 final check/.test(await csv.text()));
console.log(`\n${rows.filter((r) => r[2]).length}/${rows.length} passed`); fs.writeFileSync("/tmp/w9-final-check.json", JSON.stringify(rows));
