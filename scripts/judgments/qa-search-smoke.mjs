#!/usr/bin/env node
// Search smoke test: API checks over fetch, then page checks in headless Chrome (DevTools protocol, no dependencies; needs node --experimental-websocket on Node 20).
// usage: node --experimental-websocket scripts/judgments/qa-search-smoke.mjs [--base http://localhost:3100] [--data ../lexbharat-data/judgments-hc] [--out scripts/judgments/qa-search-report.md] [--no-ui]
// HC targets (a real party name and case number for Bombay, Delhi, Kerala, Madras) are drawn from the exported pages with a fixed seed, so they are real records.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = opt("--base", "http://localhost:3100").replace(/\/$/, ""), DATA = opt("--data", "../lexbharat-data/judgments-hc"), OUT = opt("--out", "scripts/judgments/qa-search-report.md"), UI = !args.includes("--no-ui");
const rows = []; const SC = "supreme-court-of-india";
const enc = encodeURIComponent;
async function api(p, ms = 20000) { const t = Date.now(); const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms); try { const r = await fetch(BASE + p, { signal: ctl.signal }); const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* not json */ } return { status: r.status, json, text, ms: Date.now() - t }; } catch (e) { return { status: 0, json: null, text: String(e), ms: Date.now() - t, error: String(e) }; } finally { clearTimeout(timer); } }
const rec = (group, check, query, count, ok, detail = "") => { rows.push({ group, check, query, count, ok: !!ok, detail }); console.error(`${ok ? "PASS" : "FAIL"} [${group}] ${check} | ${query} | ${count}${detail ? " | " + detail : ""}`); };
const has = (x, ...w) => w.every((t) => x.toLowerCase().includes(t.toLowerCase()));
const blob = (c) => [c.title, c.citation, c.petitioner, c.respondent, c.caseNumber, c.caseNumberExtracted].filter(Boolean).join(" ");
const page = async (p) => { const r = await api(p); return r.json ?? {}; };

// ---------------- real HC targets
let seed = 4242; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const COURTS = [["bombay-high-court", 2025], ["delhi-high-court", 2019], ["kerala-high-court", 2024], ["madras-high-court", 2021]], targets = {};
for (const [court, year] of COURTS) {
  const pages = readdirSync(path.join(DATA, `court=${court}`, `year=${year}`)).filter((x) => x.startsWith("page="));
  const list = JSON.parse(readFileSync(path.join(DATA, `court=${court}`, `year=${year}`, pages[Math.floor(rnd() * pages.length)], "data_0.json"), "utf8"));
  const cand = list.filter((r) => r.petitioner && r.respondent && /^[A-Za-z .]+$/.test(r.petitioner) && /\d+\s*(?:\/|of)\s*\d{4}/i.test(r.caseNumber ?? ""));
  const r = cand[Math.floor(rnd() * cand.length)], m = /(\d+)\s*(?:\/|of)\s*(\d{4})/i.exec(r.caseNumber);
  targets[court] = { year, rec: r, party: (r.petitioner.match(/[A-Za-z]{4,}/g) ?? []).slice(0, 2).join(" "), key: `${Number(m[1])}/${m[2]}` };
}

// ---------------- API: Supreme Court
{ const r = await page(`/api/judgments/search?q=Kesavananda&pageSize=5`);
  rec("SC", "cross-year search finds the 1973 case", "Kesavananda", r.total, r.total >= 1 && r.results?.some((x) => x.caseId === "1973_INSC_91" && x.year === 1973 && /1973/.test(x.citation ?? "")), "1973_INSC_91");
  const l = await page(`/api/judgments/list?court=${SC}&year=1990&search=insurance&pageSize=100`);
  rec("SC", "in-year search", "insurance (1990)", l.total, l.total >= 1 && l.results.every((c) => has(blob(c), "insurance")), "every result contains the word");
  const a = await api(`/api/judgments/search?q=abc&court=bogus`), b = await api(`/api/judgments/list?court=bogus&year=1990`), c = await api(`/api/judgments/search-hc?q=abc&court=bogus`), d = await api(`/api/judgments/search-hc?q=abc&court=${SC}`);
  rec("SC", "bad court parameter -> 422, no crash", "search?court=bogus", "-", a.status === 422 && a.json?.error, `HTTP ${a.status}`);
  rec("SC", "bad court parameter -> 422, no crash", "list?court=bogus", "-", b.status === 422 && b.json?.error, `HTTP ${b.status}`);
  rec("HC", "bad court parameter -> 422, no crash", "search-hc?court=bogus", "-", c.status === 422, `HTTP ${c.status}`);
  rec("HC", "Supreme Court slug on the HC endpoint -> 422", `search-hc?court=${SC}`, "-", d.status === 422, `HTTP ${d.status}`); }

// ---------------- API: High Courts
for (const [court, t] of Object.entries(targets)) {
  const name = court.replace("-high-court", "").replace(/^./, (x) => x.toUpperCase());
  const p1 = await page(`/api/judgments/search-hc?q=${enc(t.party)}&court=${court}&year=${t.year}&pageSize=50`), p2 = await page(`/api/judgments/search-hc?q=${enc(t.party)}&court=${court}&pageSize=50`);
  rec("HC", `party name, ${name} (${t.year} page)`, t.party, p1.total, p1.results?.some((x) => x.caseId === t.rec.caseId) && p1.results.every((x) => has(blob(x), ...t.party.split(" "))), "target found, every hit holds the words");
  rec("HC", `party name, ${name} (all years of the court)`, t.party, p2.total, p2.total >= p1.total && p2.total >= 1, "all-years total is at least the single-year total");
  const n = await page(`/api/judgments/search-hc?q=${enc(t.key)}&court=${court}&year=${t.year}&pageSize=50`), rx = new RegExp(`(?<!\\d)0*${t.key.split("/")[0]}\\s*(?:/|of)\\s*${t.key.split("/")[1]}(?!\\d)`, "i");
  rec("HC", `case number, ${name} (${t.year} page)`, t.key, n.total, n.results?.some((x) => x.caseId === t.rec.caseId) && n.results.every((x) => rx.test(`${x.caseNumber ?? ""} ${x.title ?? ""}`)), "target found, every hit carries the number");
}

// ---------------- year-page search (both courts): a common word, a case number, the literal year
{ const w = await page(`/api/judgments/list?court=${SC}&year=1990&search=state&pageSize=100`); rec("Year page SC", "common word", "state (1990)", w.total, w.total > 5 && w.results.every((c) => has(blob(c), "state")));
  const sc = await page(`/api/judgments/list?court=${SC}&year=2024&search=${enc("5491/2024")}&pageSize=20`); rec("Year page SC", "case number (from the judgment heading)", "5491/2024 (2024)", sc.total, sc.results?.some((c) => c.caseId === "2024_INSC_1046"), "Muskan Enterprises 2024_INSC_1046");
  const sy = await page(`/api/judgments/list?court=${SC}&year=2025&search=2024&pageSize=100`); rec("Year page SC", "literal year string on a 2025 page", "2024 (2025)", sy.total, sy.total > 0 && sy.results.every((c) => has(blob(c), "2024")), "every hit holds 2024 in its case number or citation");
  const hw = await page(`/api/judgments/search-hc?q=state&court=bombay-high-court&year=2025&pageSize=20`); rec("Year page HC", "common word", "state (Bombay 2025)", hw.total, hw.total > 5 && hw.results.every((c) => has(blob(c), "state")));
  const hn = await page(`/api/judgments/search-hc?q=${enc("933/2024")}&court=bombay-high-court&year=2025&pageSize=20`); rec("Year page HC", "case number", "933/2024 (Bombay 2025)", hn.total, hn.results?.some((c) => c.caseId === "HCBM030198422024") && hn.results.every((c) => c.year === 2025), "Gurukrupa Industries WP/933/2024 is listed on the 2025 page");
  const hy = await page(`/api/judgments/search-hc?q=2024&court=bombay-high-court&year=2025&pageSize=50`); const rx = /(?<!\d)\d+\s*(?:\/|of)\s*2024(?!\d)/i;
  rec("Year page HC", "literal year string on a 2025 page", "2024 (Bombay 2025)", hy.total, hy.total > 1000 && hy.results.every((c) => c.year === 2025 && rx.test(`${c.caseNumber ?? ""} ${c.title ?? ""}`)), "every hit is numbered x/2024 and listed under 2025"); }

// ---------------- the this-year / all-years toggle (API level; the page toggle is checked below)
{ const y = await page(`/api/judgments/search-hc?q=gurukrupa&court=bombay-high-court&year=2025`), a = await page(`/api/judgments/search-hc?q=gurukrupa&court=bombay-high-court`);
  rec("Toggle", "HC: this year vs all years", "gurukrupa (Bombay)", `${y.total} -> ${a.total}`, y.total === 1 && a.total > y.total);
  const sy = await page(`/api/judgments/list?court=${SC}&year=1990&search=kesavananda`), sa = await page(`/api/judgments/search?q=kesavananda`);
  rec("Toggle", "SC: this year vs all years", "kesavananda (1990 vs all)", `${sy.total} -> ${sa.total}`, sy.total === 0 && sa.total >= 1); }

// ---------------- result links
{ const picks = [];
  for (const [q, p] of [["kesavananda", "/api/judgments/search?q="], ["union of india", "/api/judgments/search?q="], ["muskan", "/api/judgments/search?q="], ["nazim", "/api/judgments/search?q="], ["state of punjab", "/api/judgments/search?q="]]) { const r = await page(`${p}${enc(q)}&pageSize=6`); const x = r.results?.[Math.floor(rnd() * Math.min(6, r.results.length))]; if (x) picks.push({ kind: "SC", id: x.caseId, url: `/workspace/browse/judgments/${SC}/${x.year}/${enc(x.caseId)}` }); }
  for (const [court, t] of Object.entries(targets)) { const r = await page(`/api/judgments/search-hc?q=${enc(t.party)}&court=${court}&pageSize=6`); const x = r.results?.[0]; if (x) picks.push({ kind: "HC", id: x.caseId, url: `/workspace/browse/judgments/${x.court}/${x.year}/${enc(x.caseId)}?p=${x.mainPage}` }); }
  const r = await page(`/api/judgments/search-hc?q=${enc("6241/2019")}&pageSize=6`); for (const x of (r.results ?? []).slice(0, 2)) picks.push({ kind: "HC", id: x.caseId, url: `/workspace/browse/judgments/${x.court}/${x.year}/${enc(x.caseId)}?p=${x.mainPage}` });
  let ok = 0; const bad = [];
  for (const p of picks.slice(0, 10)) { const g = await api(p.url); const good = g.status === 200 && g.text.includes(p.id); ok += good; if (!good) bad.push(`${p.id} ${g.status}`); }
  rec("Links", "result links land on the right case page", `${Math.min(10, picks.length)} links (SC and HC)`, `${ok}/${Math.min(10, picks.length)}`, ok === Math.min(10, picks.length) && picks.length >= 10, bad.join("; ")); }

// ---------------- garbage input: no crash, no hang, graceful answer, on all three search endpoints
const GARBAGE = [["empty string", ""], ["random characters", "xqzjwvkp"], ["special characters", "<>%$&"], ["percent and null bytes", "%00%0a%25"], ["quote and SQL", "'; DROP TABLE cases;--"], ["very long input (1,000 chars)", "kumar ".repeat(170)], ["non-Latin characters", "名前★"], ["single character", "a"]];
for (const [label, q] of GARBAGE) for (const [name, make] of [["SC search", (s) => `/api/judgments/search?q=${enc(s)}`], ["SC year list", (s) => `/api/judgments/list?court=${SC}&year=1990&search=${enc(s)}`], ["HC search", (s) => `/api/judgments/search-hc?q=${enc(s)}&court=bombay-high-court&year=2025`]]) {
  const r = await api(make(q), 8000); const unfilteredList = name === "SC year list" && q === "";   // an empty search parameter on the year list simply means "no search": the whole year, 200
  const ok = (r.status === 200 || r.status === 422) && r.json && r.ms < 5000 && (r.status === 422 ? !!r.json.error : unfilteredList || (r.json.total ?? 0) === 0 || label === "very long input (1,000 chars)");
  rec("Garbage", `${label} -> ${name}`, JSON.stringify(q.slice(0, 22)) + (q.length > 22 ? "…" : ""), r.json?.total ?? "-", ok, `HTTP ${r.status}, ${r.ms} ms${r.status === 422 ? ", " + String(r.json?.error).slice(0, 50) : ""}`); }

// accents fold instead of splitting a word: "ñandú" is read as "nandu" on every search (it used to become the word "and" on the Supreme Court search)
{ const a = await page(`/api/judgments/search?q=${enc("ñandú")}`), b = await page(`/api/judgments/search?q=nandu`), c = await page(`/api/judgments/search-hc?q=${enc("ñandú")}`), d = await page(`/api/judgments/search-hc?q=nandu`);
  rec("Garbage", "accented letters fold, not split", "ñandú vs nandu", `SC ${a.total}/${b.total}, HC ${c.total}/${d.total}`, a.total === b.total && c.total === d.total && a.total < 100, "same results with and without accents"); }

// ---------------- pages in headless Chrome
if (UI) {
  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", PORT = 9335;
  class CDP { constructor(ws) { this.ws = ws; this.id = 0; this.p = new Map(); this.h = []; ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id) { const x = this.p.get(m.id); if (x) { this.p.delete(m.id); m.error ? x.rej(new Error(m.error.message)) : x.res(m.result); } } else this.h.forEach((f) => f(m)); }); } send(method, params = {}, sessionId) { const id = ++this.id; return new Promise((res, rej) => { this.p.set(id, { res, rej }); this.ws.send(JSON.stringify({ id, method, params, sessionId })); }); } }
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "qa-search-profile")}`, "--no-first-run", "--window-size=1280,900", "about:blank"], { stdio: "ignore" });
  let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 200)); } }
  const ws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r)); const cdp = new CDP(ws);
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }); const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId); await S("Page.enable"); await S("Runtime.enable");
  const errors = []; cdp.h.push((m) => { if (m.sessionId === sessionId && m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text + " " + (m.params.exceptionDetails.exception?.description ?? "").slice(0, 80)); });
  const ev = async (expr) => { const r = await S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
  const go = async (url) => { errors.length = 0; const loaded = new Promise((res) => { const h = (m) => { if (m.sessionId === sessionId && m.method === "Page.loadEventFired") { cdp.h.splice(cdp.h.indexOf(h), 1); res(); } }; cdp.h.push(h); setTimeout(res, 30000); }); await S("Page.navigate", { url }); await loaded; await new Promise((r) => setTimeout(r, 1800)); };
  const type = (sel, text) => ev(`(async()=>{const i=document.querySelector(${JSON.stringify(sel)}); if(!i) return 'NO INPUT'; i.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(text)}); i.dispatchEvent(new Event('input',{bubbles:true})); await new Promise(r=>setTimeout(r,3000)); return i.value.length;})()`);
  const status = () => ev(`(document.querySelector('[role=status]')||{}).textContent||''`);
  const num = (s) => Number((/([\d,]+)/.exec(s ?? "") ?? [])[1]?.replace(/,/g, "") ?? NaN);
  try {
    // SC year page: bar present, in-year search, toggle
    await go(`${BASE}/workspace/browse/judgments/${SC}?year=1990`);
    const has1 = await ev(`!!document.querySelector('#case-q')`); rec("Page SC", "year page has the search bar", "?year=1990", "-", has1);
    await type("#case-q", "insurance"); const s1 = await status(); rec("Page SC", "in-year search on the page", "insurance", num(s1), num(s1) >= 1 && /in 1990|match/.test(s1) && /1990/.test(s1), s1);
    await ev(`[...document.querySelectorAll('[role=group] button')].find(b=>/All years/.test(b.innerText))?.click()`); await new Promise((r) => setTimeout(r, 2500)); const s2 = await status();
    rec("Page SC", "this year / all years toggle", "insurance", `${num(s1)} -> ${num(s2)}`, num(s2) > num(s1) && /all years/.test(s2), s2);
    await type("#case-q", "kesavananda"); const s3 = await status(); const row = await ev(`(document.querySelector('ul.mt-2 li a')||{}).getAttribute&&document.querySelector('ul.mt-2 li a').getAttribute('href')`);
    rec("Page SC", "Kesavananda across years from a 1990 page", "kesavananda (all years)", num(s3), num(s3) >= 1 && /1973_INSC_91/.test(row ?? ""), String(row));
    // HC year page: "2024" on a 2025 page, toggle
    await go(`${BASE}/workspace/browse/judgments/bombay-high-court?year=2025`);
    await type("#case-q", "2024"); const h1 = await status(); const first = await ev(`(document.querySelector('ul.mt-2 li')||{}).innerText||''`);
    rec("Page HC", '"2024" on the Bombay 2025 page', "2024", num(h1), num(h1) > 1000 && /2024/.test(first) && /in 2025/.test(h1), `${h1} | first: ${first.replace(/\n/g, " ").slice(0, 70)}`);
    await type("#case-q", "gurukrupa"); const h2 = await status(); await ev(`[...document.querySelectorAll('[role=group] button')].find(b=>/All years/.test(b.innerText))?.click()`); await new Promise((r) => setTimeout(r, 2500)); const h3 = await status();
    rec("Page HC", "this year / all years toggle", "gurukrupa", `${num(h2)} -> ${num(h3)}`, num(h2) === 1 && num(h3) > 1, h3);
    // court overview pages (no year chosen): same bar on both courts
    for (const [court, q, expect] of [[SC, "kesavananda", /Supreme Court cases[\s\S]*1 case/], ["bombay-high-court", "gurukrupa", /High Court cases/]]) {
      await go(`${BASE}/workspace/browse/judgments/${court}`); const r = await type("#court-q", q); const t = await ev(`document.querySelector('main').innerText`);
      rec(court === SC ? "Page SC" : "Page HC", "court page (year grid) has the same search bar", q, "-", r !== "NO INPUT" && expect.test(t) && !(await ev(`!!document.querySelector('[role=alert]')`))); }
    // browse page: garbage and long input in the real bar
    await go(`${BASE}/workspace/browse`);
    for (const [label, q] of [["special characters", "<>%$&"], ["random characters", "xqzjwvkp"]]) { await type("#browse-q", q); const t = await ev(`document.querySelector('main').innerText`);
      rec("Page garbage", `${label} in the browse search bar`, q, "-", !(await ev(`!!document.querySelector('[role=alert]')`)) && !/undefined|NaN|\[object/.test(t) && /0 cases|No Supreme Court case matches|No High Court case matches|Type a name/.test(t), "graceful empty state, no error alert"); }
    const len = await type("#browse-q", "kumar ".repeat(100)); rec("Page garbage", "600-character paste in the search bar", "kumar kumar ...", len, len === 200 && !(await ev(`!!document.querySelector('[role=alert]')`)), "input clamps at 200 characters, no error");
    rec("Pages", "no uncaught script errors during the page checks", "-", errors.length, errors.length === 0, errors[0] ?? "");
  } catch (e) { rec("Pages", "page checks ran to the end", "-", "-", false, String(e).slice(0, 160)); }
  chrome.kill();
}

const pass = rows.filter((r) => r.ok).length;
const md = `# Search smoke test

Run against ${BASE} on ${new Date().toISOString().slice(0, 10)} with \`node --experimental-websocket scripts/judgments/qa-search-smoke.mjs\`. **${pass} of ${rows.length} checks pass.**
HC targets are real records drawn from the exported pages with a fixed seed. "Garbage" rows must answer 200 with no results or 422 with a message, in under 5 s, as JSON.

| Group | Check | Query | Results | Result | Detail |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.group} | ${r.check} | ${String(r.query).replace(/\|/g, "\\|")} | ${r.count} | ${r.ok ? "PASS" : "**FAIL**"} | ${String(r.detail).replace(/\|/g, "\\|").slice(0, 120)} |`).join("\n")}
`;
writeFileSync(OUT, md); console.log(md); process.exit(pass === rows.length ? 0 : 1);
