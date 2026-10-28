#!/usr/bin/env node
// Rendered-page spot check of Supreme Court case pages on a live (or local) site, driving headless Chrome over the DevTools protocol with Node built-ins only
// (Playwright is not a dependency of this project). Needs: node --experimental-websocket (Node 20) and Google Chrome.
// usage: node --experimental-websocket scripts/judgments/qa-live.mjs [--base https://lexbharat-bay.vercel.app] [--seed 7] [--out scripts/judgments/qa-live-report.md]
// Sample: up to 5 records flagged by qa-sweep (topped up with edge cases), 5 from 1950-1999, 5 from 2000-2009, 10 from 2010-2025, and the 5 known cases.
// Each page: HTTP 200, heading, the record's citation, no undefined/NaN/null/[object Object] text, no empty value cells, provenance panel, extracted bench and case number
// as stored in the repo's data, and a working back link. Failures are screenshotted to qa/screenshots/live/.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt("--base", "https://lexbharat-bay.vercel.app").replace(/\/$/, ""), SEED = Number(opt("--seed", "7")), OUT = opt("--out", "scripts/judgments/qa-live-report.md");
const SHOTS = "qa/screenshots/live", CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", PORT = 9334;
mkdirSync(SHOTS, { recursive: true });

// ---- records and sample
const records = [];
for (const f of readdirSync("src/data/judgments/sc").filter((x) => x.endsWith(".json")).sort()) for (const c of JSON.parse(readFileSync(`src/data/judgments/sc/${f}`, "utf8"))) records.push({ ...c, year: Number(f.slice(0, 4)) });
const byId = new Map(records.map((r) => [r.caseId, r]));
let s = SEED; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = (pool, n, used) => { const out = []; const p = pool.filter((r) => !used.has(r.caseId)); while (out.length < n && p.length) { const r = p.splice(Math.floor(rnd() * p.length), 1)[0]; out.push(r); used.add(r.caseId); } return out; };
const used = new Set(), sample = [];
const add = (rs, group) => rs.forEach((r) => sample.push({ ...r, group }));
const KNOWN = [["1973_INSC_91", "Kesavananda Bharati"], ["2024_INSC_1046", "Muskan Enterprises"], ["2025_INSC_1184", "Nazim"], ["2022_INSC_326", "Vijay Kumar Ghai"], ["2025_INSC_1288", "Mihir Rajesh Shah"]];
KNOWN.forEach(([id]) => used.add(id));
const flagged = existsSync(path.join(tmpdir(), "qa-sweep-failures.json")) ? JSON.parse(readFileSync(path.join(tmpdir(), "qa-sweep-failures.json"), "utf8")) : [];
const reviewed = ["1951_INSC_17"];                                                   // flagged by the sweep and reviewed as correct
const fromList = [...flagged, ...reviewed].map((id) => byId.get(id)).filter((r) => r && !used.has(r.caseId)).slice(0, 5); fromList.forEach((r) => used.add(r.caseId));
add(fromList, "QA flag (sweep failure or reviewed flag)");
const edge = [["no disposition recorded", (r) => !r.disposition], ["no citation recorded", (r) => !r.citation], ["no authoring judge", (r) => !r.judges?.length], ["no bench and no case number, modern", (r) => r.year >= 2015 && !r.benchExtracted && !r.caseNumberExtracted], ["bench but no case number", (r) => r.benchExtracted && !r.caseNumberExtracted && r.year < 2000]];
for (let i = 0; fromList.length + sample.filter((x) => x.group.startsWith("Edge")).length < 5 && i < edge.length; i++) add(pick(records.filter(edge[i][1]), 1, used), `Edge case: ${edge[i][0]}`);
add(pick(records.filter((r) => r.year <= 1999), 5, used), "1950-1999");
add(pick(records.filter((r) => r.year >= 2000 && r.year <= 2009), 5, used), "2000-2009");
add(pick(records.filter((r) => r.year >= 2010 && r.year <= 2025), 10, used), "2010-2025");
for (const [id, label] of KNOWN) add([byId.get(id)], `Known: ${label}`);

// ---- minimal CDP client
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = []; ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id) { const p = this.pending.get(m.id); if (p) { this.pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } } else for (const h of this.handlers) h(m); }); }
  send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); }
}
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "qa-live-profile")}`, "--no-first-run", "--no-default-browser-check", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 200)); } }
const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
const cdp = new CDP(ws);
const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => cdp.send(m, p, sessionId);
await S("Page.enable"); await S("Network.enable"); await S("Runtime.enable");
await S("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
let docStatus = 0, consoleErrors = [];
cdp.handlers.push((m) => { if (m.sessionId !== sessionId) return;
  if (m.method === "Network.responseReceived" && m.params.type === "Document") docStatus = m.params.response.status;
  if (m.method === "Runtime.exceptionThrown") consoleErrors.push(m.params.exceptionDetails.text); });
const evaluate = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const go = async (url) => {
  docStatus = 0; consoleErrors = [];
  const loaded = new Promise((res) => { const h = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { cdp.handlers.splice(cdp.handlers.indexOf(h), 1); res(); } }; cdp.handlers.push(h); setTimeout(res, 30000); });
  await S("Page.navigate", { url }); await loaded; await new Promise((r) => setTimeout(r, 1500));
};

// ---- the page check, run inside the page
const PAGE = `(() => {
  const main = document.querySelector('main') || document.body, text = main.innerText;
  const dds = [...main.querySelectorAll('dl dd')].map((d) => d.innerText.trim());
  const prov = [...main.querySelectorAll('section')].find((x) => /where each field comes from/i.test(x.textContent));   // innerText is upper-cased by CSS, textContent is not
  const dts = [...main.querySelectorAll('dl dt')].map((d) => d.textContent.trim());
  const back = [...main.querySelectorAll('a')].find((a) => /Back to \\d{4} cases/.test(a.innerText));
  const bad = (text.match(/\\bundefined\\b|\\bNaN\\b|\\[object Object\\]|\\bnull\\b/g) || []);
  return { h1: (main.querySelector('h1') || {}).innerText || '', text, dds, dts, emptyDd: dds.filter((d) => !d).length, bad, provRows: prov ? prov.querySelectorAll('li').length : 0,
           provHeading: !!prov, backHref: back ? back.getAttribute('href') : null, title: document.title };
})()`;

const rows = [];
for (const r of sample) {
  const url = `${BASE}/judgments/supreme-court-of-india/${r.year}/${encodeURIComponent(r.caseId)}`, why = [];
  let page = null;
  try {
    await go(url); page = await evaluate(PAGE);
    if (docStatus !== 200) why.push(`HTTP ${docStatus}`);
    if (!page.h1.trim()) why.push("empty heading");
    if (r.citation ? !page.text.includes(r.citation) : !/No citation recorded/.test(page.text)) why.push(r.citation ? `citation ${r.citation} not shown` : "missing-citation note not shown");
    if (page.bad.length) why.push(`bad text: ${[...new Set(page.bad)].join(", ")}`);
    if (page.emptyDd) why.push(`${page.emptyDd} empty value cell(s)`);
    if (!page.provHeading || page.provRows < 10) why.push(`provenance panel ${page.provHeading ? `has ${page.provRows} rows` : "missing"}`);
    if (r.benchExtracted) { const miss = r.benchExtracted.filter((n) => !page.text.includes(n)); if (miss.length) why.push(`stored bench not shown (${r.benchExtracted.length - miss.length}/${r.benchExtracted.length}): production data may be older than the repo`); if (!page.dts.includes("Bench (from judgment text)")) why.push("no 'Bench (from judgment text)' row"); }
    else if (page.dts.includes("Bench (from judgment text)")) why.push("bench row shown although the repo has no bench for this case");
    if (r.caseNumberExtracted && !page.text.includes(r.caseNumberExtracted)) why.push(`case number ${r.caseNumberExtracted} not shown: production data may be older than the repo`);
    // back link: click it and check where we land
    if (!page.backHref) why.push("no back link"); else {
      await evaluate(`[...document.querySelectorAll('main a')].find((a) => /Back to \\d{4} cases/.test(a.innerText)).click()`);
      await new Promise((x) => setTimeout(x, 2500));
      const landed = await evaluate(`({ path: location.pathname + location.search, body: (document.querySelector('main')||document.body).innerText.slice(0, 400) })`);
      if (!landed.path.startsWith("/library/judgments/supreme-court-of-india?year=" + r.year) || !/case records in/.test(landed.body + (await evaluate("document.body.innerText")))) why.push(`back link landed on ${landed.path}`);
    }
  } catch (e) { why.push(`error: ${String(e.message).slice(0, 100)}`); }
  if (why.length) { try { await go(url); const shot = await S("Page.captureScreenshot", { format: "jpeg", quality: 60 }); writeFileSync(path.join(SHOTS, `${r.caseId}.jpg`), Buffer.from(shot.data, "base64")); } catch { /* screenshot is best-effort */ } }
  rows.push({ id: r.caseId, year: r.year, group: r.group, title: (r.title ?? "").slice(0, 38), citation: r.citation ?? "—", status: docStatus, ok: !why.length, why });
  process.stderr.write(`${why.length ? "FAIL" : "PASS"} ${r.caseId} ${r.group}${why.length ? " | " + why.join("; ") : ""}\n`);
}
chrome.kill();

const pass = rows.filter((x) => x.ok).length;
const md = `# Supreme Court case pages: live spot check

Site: ${BASE} on ${new Date().toISOString().slice(0, 10)}. Browser: headless Google Chrome over the DevTools protocol (Playwright is not installed in this project). Sample seed ${SEED}. **${pass} of ${rows.length} pages passed.**
Checks per page: HTTP 200; heading; the record's citation (or the "No citation recorded" note); no undefined / NaN / null / [object Object]; no empty value cells; provenance panel with its field rows; the stored extracted bench and case number are shown; the back link returns to the year's case list. Screenshots of failures: \`${SHOTS}/<caseId>.jpg\`.

| Result | Case | Year | Group | Title | Citation | HTTP | Problems |
|---|---|---|---|---|---|---|---|
${rows.map((x) => `| ${x.ok ? "PASS" : "FAIL"} | ${x.id} | ${x.year} | ${x.group} | ${x.title} | ${x.citation} | ${x.status} | ${x.why.join("; ") || ""} |`).join("\n")}
`;
writeFileSync(OUT, md); console.log(md);
process.exit(pass === rows.length ? 0 : 1);
