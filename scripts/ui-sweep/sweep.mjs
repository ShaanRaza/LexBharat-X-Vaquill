// npm run ui-sweep: opens every page type in a real browser (Chrome) at 1280 px and 375 px and checks what the static audit (src/ui-audit.test.mjs) cannot see.
//   hidden     content under the sticky header or the phone tab bar (at the top, at the bottom, after keyboard focus, and in sticky columns)
//   hscroll    the page scrolls sideways, or something sticks out past the screen edge
//   raw        source junk or programming leftovers in the visible text (the display layer's residue list, scripts/ui-sweep/rules.mjs)
//   wording    wording from the old design
//   clickable  something that looks clickable but is not (pointer cursor on plain text), or a link that goes nowhere / to a page that errors
//   oldlink    a link to the old India Code address (indiacode.nic.in), which no longer opens
//   tailhead   a section's text ends with a heading line (the next chapter's title stuck to it)
//   gaplink    the page says a section is not in our library but has no "Read ... on India Code" link
//   gaprepeat  a missing section is said more than once (the sentence, "I couldn't find", a note) or its India Code link is shown more than once
//   listflag   a section whose text is only a table of contents ("375. Rape. 376. Punishment ...") is shown as "No problems detected"
//   lookup     (API) asking for a section that a central Act lacks returns a state copy instead of "not in our library"
//   console    errors in the browser console, failed requests, broken images
// Starts its own server (scripts/ui-sweep/serve.sh, port 3300, no AI keys, nothing written anywhere) unless one is already up. Ask is answered from a canned stream, so no model quota is used.
// Exit code 1 if anything is found that is not listed in scripts/ui-sweep/allow.json (each entry needs a reason). Screenshots: .ui-sweep/<viewport>/<page>.png, report: .ui-sweep/report.json.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { OLD_WORDING, RAW_ON_PAGE } from "./rules.mjs";

const BASE = process.env.SWEEP_BASE ?? "http://localhost:3300", PASSWORD = "throwaway-local-test-9", OUT = ".ui-sweep";
const VIEWPORTS = [{ id: "desktop-1280", width: 1280, height: 800, mobile: false }, { id: "phone-375", width: 375, height: 812, mobile: true }];
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7), noShots = process.argv.includes("--no-shots");
const allow = JSON.parse(fs.readFileSync(new URL("./allow.json", import.meta.url), "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { try { return (await fetch(`${BASE}/access`)).ok; } catch { return false; } }
async function startServer() {
  if (await up()) return null;
  const child = spawn("sh", ["scripts/ui-sweep/serve.sh"], { stdio: "ignore", detached: true });
  for (let i = 0; i < 90; i++) { if (await up()) return child; await sleep(1000); }
  throw new Error("the sweep server did not start");
}

// ---- ids of real things to open (found at run time, so the sweep keeps working when the data changes) ----
async function findTargets(req) {
  const j = async (u) => (await req.get(BASE + u)).json();
  const nl = (await j("/api/quickfind?q=138%20negotiable")).laws?.[0], ts = (await j("/api/quickfind?q=420%20ipc")).laws?.[0];
  const reg = (await j("/api/acts/list")).results?.find((x) => x.category === "regulatory");
  const li = await j("/api/judgments/list?court=supreme-court-of-india&year=2020&limit=1");
  const c = li.results?.[0];
  if (!nl || !reg || !c) throw new Error("could not find an Act, a regulator document and a judgment to open");
  return { nl, ts, reg, caseId: c.caseId, year: 2020 };
}

// a canned Ask answer: the real stream format (src/app/api/chat/route.ts), real sections, so the cited panel loads real text
function askStream(t) {
  const cite = (n, x) => ({ n, actId: x.actId, sectionKey: x.sectionKey, actTitle: x.actTitle, number: x.number, heading: x.heading, status: "in_force", category: x.category ?? "central", state: null, preview: x.heading ?? "" });
  const sources = [cite(1, t.nl), ...(t.ts ? [cite(2, t.ts)] : [])];
  const answer = `A cheque that is returned unpaid for want of funds can lead to a criminal complaint under the Negotiable Instruments Act, 1881 [1]. The payee must first give a written demand notice within 30 days of the bank's memo [1].\n\nCheating by deceiving someone into handing over property is a separate offence [2].\n\nRelated provisions\n- Section 138 of the Negotiable Instruments Act, 1881 [1]`;
  const lines = [{ type: "start", chatId: "11111111-2222-4333-8444-555555555555" }, { type: "sources", sources, queries: ["notice after cheque bounces"] }, { type: "delta", text: answer }, { type: "check", label: "supported", unsupported: [] }, { type: "done", messageId: 1 }];
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}

// a canned Ask answer for a section the library does not hold: the sentence in the answer and the link under it (src/lib/chat/gaps.mjs, the "absent" note of the check event)
function askMissingStream() {
  const text = "Section 375 of the Indian Penal Code isn't in our library yet.";
  const url = "https://indiacode.gov.in/collections/69a0c1fb-7b22-4481-b16a-1dc59b5d02e6?query=Indian%20Penal%20Code";
  const absent = [{ kind: "missing", text, url, actTitle: "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)", label: "Read Section 375 of the Indian Penal Code on India Code (search for this Act)" }];
  return [{ type: "start", chatId: "11111111-2222-4333-8444-555555555556" }, { type: "sources", sources: [], queries: [] }, { type: "delta", text }, { type: "check", label: "not_found", unsupported: [], absent }, { type: "done", messageId: 2 }].map((l) => JSON.stringify(l)).join("\n") + "\n";
}

// Search when meaning search is busy: the real keyword answer from the server with its `semantic` field set the way the server sets it after a Voyage 429, so the page must show the notice (src/lib/acts/meaning.mjs).
const FALLBACK_TEXT = "Showing exact-word results — meaning search is busy.";
const asFallback = (apiPath, fetchAs) => async (p) => {
  await p.route(apiPath, async (r) => {
    const u = new URL(r.request().url()); fetchAs(u);
    const res = await r.fetch({ url: u.toString() }), j = await res.json();
    await r.fulfill({ response: res, json: { ...j, semantic: { used: false, reason: "semantic_error", cause: "rate_limited" } } });
  });
};
const seesNotice = async (p) => { await p.getByText(FALLBACK_TEXT).first().waitFor({ timeout: 15000 }).catch(() => { throw new Error(`the fallback notice "${FALLBACK_TEXT}" is not on the page`); }); };
const CASE_TITLE_DANGLING = [/\b(?:versus|vs\.?|v\.)[ \t]*[.,]?[ \t]*$/m, "a case name ends with a dangling \"versus\""];
const pages = (t) => [
  { id: "desk", url: "/" },
  { id: "ask-empty", url: "/ask" },
  { id: "ask-answer", url: "/ask", prep: async (p, v) => {
    await p.route("**/api/chat", (r) => r.request().method() === "POST" ? r.fulfill({ status: 200, contentType: "application/x-ndjson", body: askStream(t) }) : r.continue());
    await p.fill("textarea", "notice after cheque bounces"); await p.keyboard.press("Enter");
    await p.waitForSelector("article button[aria-pressed]", { timeout: 15000 });
    if (v.mobile) await p.click("article button[aria-pressed]");   // on a phone the cited page is a bottom sheet that opens on a tap
    await p.waitForFunction(() => /Dishonour|cheque/i.test(document.body.innerText) && !/Loading/.test(document.querySelector("aside, [data-cited]")?.textContent ?? ""), null, { timeout: 15000 }).catch(() => null);
    await p.waitForTimeout(600);
  } },
  { id: "ask-missing-section", url: "/ask", prep: async (p) => {
    await p.route("**/api/chat", (r) => r.request().method() === "POST" ? r.fulfill({ status: 200, contentType: "application/x-ndjson", body: askMissingStream() }) : r.continue());
    await p.fill("textarea", "What does Section 375 of the Indian Penal Code say?"); await p.keyboard.press("Enter");
    await p.getByText("isn't in our library yet").first().waitFor({ timeout: 15000 }); await p.waitForTimeout(600);
  } },
  { id: "search-missing-section", url: "/search?q=375%20indian%20penal%20code", wait: 4000 },   // Search says it once with one link too (same wording as Ask)
  { id: "law-contents-list", url: "/law/IND_state_15289/s375" },
  { id: "law-quote-marks", url: "/law/IND_state_15289/s010" },   // the source prints its quotation marks as long and double bars: curly quotes on screen (src/lib/text/clean.mjs fixQuoteMarks)
  { id: "search-laws", url: "/search?q=notice%20after%20cheque%20bounces", wait: 4000 },
  { id: "search-laws-fallback", url: "/search?q=notice%20after%20cheque%20bounces", before: asFallback("**/api/acts/search*", (u) => u.searchParams.set("exact", "1")), prep: seesNotice },
  { id: "search-judgments", url: "/search?q=bail&tab=judgments", wait: 4000, forbid: [CASE_TITLE_DANGLING] },
  { id: "search-judgments-fallback", url: "/search?q=right%20to%20privacy&tab=judgments", before: asFallback("**/api/judgments/search-text*", (u) => u.searchParams.set("mode", "words")), prep: seesNotice },
  { id: "search-documents", url: "/search?tab=documents" },
  { id: "library-overview", url: "/library" },
  { id: "old-to-new", url: "/library/old-to-new" },
  { id: "old-to-new-full-table", url: "/library/old-to-new", prep: async (p) => { await p.click("button[aria-expanded]"); await p.waitForSelector("button[aria-expanded=true]"); await p.waitForTimeout(400); } },
  { id: "law-section-not-found", url: "/law/IND_central_20062/s9999" },
  { id: "library-acts", url: "/library?tab=acts" },
  { id: "library-constitution", url: "/library?tab=constitution" },
  { id: "library-regulators", url: "/library?tab=regulators" },
  { id: "library-judgments", url: "/library?tab=judgments" },
  { id: "library-court", url: "/library/judgments/supreme-court-of-india" },
  { id: "law-page", url: `/law/${encodeURIComponent(t.nl.actId)}/${encodeURIComponent(t.nl.sectionKey)}` },
  { id: "law-page-act", url: `/law/${encodeURIComponent(t.nl.actId)}` },
  { id: "regulator-document", url: `/law/${encodeURIComponent(t.reg.actId)}`, forbid: [[/India Code/i, "a regulator document mentions India Code"], [/^Acts$/m, "a regulator document is filed under Acts in its breadcrumb"], [/\bSection \d/, "a regulator document calls its units Sections"]] },
  { id: "judgment", url: `/judgments/supreme-court-of-india/${t.year}/${encodeURIComponent(t.caseId)}`, wait: 2500, forbid: [CASE_TITLE_DANGLING] },
  { id: "work-drafts", url: "/work/drafts" },
  { id: "work-reviews", url: "/work/reviews" },
  { id: "work-vault", url: "/work/vault" },
  { id: "terms", url: "/terms" }, { id: "privacy", url: "/privacy" }, { id: "security", url: "/security" },
  { id: "password-page", url: "/access", anon: true },
  { id: "error-page", url: "/ui-sweep-error", allowStatus: [500] },
  { id: "not-found", url: "/this-page-does-not-exist", allowStatus: [404] },
];

// ---- the checks, run inside the page ----
const IN_PAGE = String.raw`(args) => {
  const out = [];
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0; };
  const label = (el) => (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + " \"" + (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40) + "\"");
  // the bars: sticky/fixed elements pinned to the top or bottom edge and wide (the header, the tab bar, the testing banner)
  const barEls = [...document.querySelectorAll("header, nav, div, aside")].filter((el) => { const cs = getComputedStyle(el); if (!/fixed|sticky/.test(cs.position) || !vis(el)) return false; const r = el.getBoundingClientRect(); return r.width >= vw * 0.9 && r.height < 200 && (r.top <= 1 || r.bottom >= vh - 1); });
  const inBar = (el) => barEls.some((b) => b.contains(el));
  const barBottom = () => Math.max(0, ...barEls.map((b) => b.getBoundingClientRect()).filter((r) => r.top <= 1).map((r) => r.bottom));
  const barTop = () => Math.min(vh, ...barEls.map((b) => b.getBoundingClientRect()).filter((r) => r.bottom >= vh - 1).map((r) => r.top));
  const covered = (el) => { const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > vh) return false; const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + Math.min(r.height / 2, 12))); const top = document.elementFromPoint(x, y); return !!top && !el.contains(top) && !top.contains(el) && inBar(top); };
  // 1. sideways scroll and anything past the right edge
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) {
    const wide = [...document.querySelectorAll("body *")].filter((el) => vis(el) && el.getBoundingClientRect().right > vw + 1 && !el.closest("[data-sweep-ok], pre, table, [style*=overflow], .overflow-x-auto, .overflow-auto") && !(() => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") return true; } return false; })()).slice(0, 3).map(label);
    out.push({ kind: "hscroll", detail: "page is " + sw + " px wide in a " + vw + " px window" + (wide.length ? "; sticking out: " + wide.join(" | ") : "") });
  }
  // 2. hidden under the bars: top of the page, bottom of the page, keyboard focus, sticky columns
  const hdr = barBottom();
  window.scrollTo(0, 0);
  const main = document.querySelector("main") || document.body;
  for (const el of [...main.querySelectorAll("h1, h2, a[href], button, input, textarea, select")].filter(vis).slice(0, 40)) { const r = el.getBoundingClientRect(); if (r.top < hdr - 1 && r.bottom > 0 && !inBar(el) && getComputedStyle(el).position !== "fixed" && getComputedStyle(el).position !== "sticky") { out.push({ kind: "hidden", detail: "at the top of the page, under the header: " + label(el) }); break; } }
  window.scrollTo(0, document.documentElement.scrollHeight);
  const last = [...main.querySelectorAll("*")].filter((el) => vis(el) && !inBar(el) && el.children.length === 0 && (el.textContent || "").trim().length > 0 && !el.closest("[aria-hidden=true]") && !(() => { for (let p = el; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/fixed|sticky/.test(cs.position) || /auto|scroll/.test(cs.overflowY)) return true; } return false; })()).map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.top < vh && x.r.bottom > 0 && !(getComputedStyle(x.el).position === "sticky")).sort((a, b) => b.r.bottom - a.r.bottom)[0];
  const tb = barTop();
  if (last && last.r.bottom > tb + 1 && document.documentElement.scrollHeight > vh) out.push({ kind: "hidden", detail: "at the bottom of the page, the last text is under the bottom bar: " + label(last.el) + " (bottom " + Math.round(last.r.bottom) + " px, bar top " + Math.round(tb) + " px)" });
  // keyboard focus: focus a spread of controls (the browser scrolls them into view) and see whether a bar covers them
  window.scrollTo(0, 0);
  const ctrls = [...main.querySelectorAll("a[href], button:not([disabled]), input, textarea, select, [tabindex='0']")].filter((el) => vis(el) && !inBar(el) && getComputedStyle(el).position !== "fixed" && getComputedStyle(el).position !== "sticky");
  const pick = ctrls.length <= 14 ? ctrls : [...ctrls.slice(0, 4), ...Array.from({ length: 6 }, (_, i) => ctrls[Math.floor(((i + 1) * ctrls.length) / 7)]), ...ctrls.slice(-4)];
  let hid = 0; for (const el of pick) { el.focus({ preventScroll: false }); el.scrollIntoView({ block: "nearest" }); if (covered(el) && hid++ < 2) out.push({ kind: "hidden", detail: "after focus or scroll-into-view, covered by a bar: " + label(el) }); }
  // sticky columns: halfway down the page they must sit below the header
  window.scrollTo(0, Math.max(0, (document.documentElement.scrollHeight - vh) / 2));
  for (const el of [...document.querySelectorAll("main *, aside")].filter((e) => getComputedStyle(e).position === "sticky" && vis(e) && !inBar(e))) { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (cs.top !== "auto" && r.top >= 0 && r.top < hdr - 1 && r.height > 40) out.push({ kind: "hidden", detail: "sticky element sits under the header (top " + Math.round(r.top) + " px, header ends " + Math.round(hdr) + " px): " + label(el) }); if (cs.top !== "auto" && r.height > 40 && r.top < vh && r.bottom > vh + 1 && !(el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(cs.overflowY) && el.getBoundingClientRect().height <= vh - hdr + 1)) out.push({ kind: "hidden", detail: "sticky column is taller than the screen, its bottom is cut off (bottom " + Math.round(r.bottom) + " px, screen " + vh + " px): " + label(el) }); }
  window.scrollTo(0, 0);
  // 3. raw junk and old wording in the visible text
  const text = (main.innerText || "");
  for (const [k, src] of Object.entries(args.raw)) { const m = new RegExp(src[0], src[1]).exec(text); if (m) { const i = m.index; out.push({ kind: "raw", detail: k + ": ..." + text.slice(Math.max(0, i - 25), i + 45).replace(/\s+/g, " ") + "..." }); } }
  const all = document.body.innerText;
  for (const [src, flags] of args.old) { const m = new RegExp(src, flags).exec(all); if (m) out.push({ kind: "wording", detail: "old-design wording \"" + m[0] + "\": ..." + all.slice(Math.max(0, m.index - 25), m.index + 40).replace(/\s+/g, " ") + "..." }); }
  // 4. looks clickable but is not: a pointer cursor on something that is not a control and has no control around it; links that go nowhere
  const isCtl = (el) => el.closest("a[href], button, input, select, textarea, summary, label, [role=button], [role=link], [role=tab], [role=option], [role=menuitem], [role=checkbox], [role=switch], [role=radio], [onclick], [tabindex]");
  let bad = 0;
  for (const el of document.querySelectorAll("body *")) { if (!vis(el) || bad >= 5) continue; const cs = getComputedStyle(el); if (cs.cursor !== "pointer" || isCtl(el)) continue; if (el.querySelector("a[href], button, [role=button], [role=option]")) continue; if (el.closest("svg")) continue; if (cs.pointerEvents === "none") continue; bad++; out.push({ kind: "clickable", detail: "pointer cursor but not a control: " + label(el) }); }
  for (const a of document.querySelectorAll("a")) { const h = a.getAttribute("href"); if (vis(a) && (h === null || h === "" || h === "#")) out.push({ kind: "clickable", detail: "link that goes nowhere (href=" + JSON.stringify(h) + "): " + label(a) }); }
  for (const b of document.querySelectorAll("button:not([disabled])")) { if (vis(b) && !b.textContent.trim() && !b.getAttribute("aria-label") && !b.getAttribute("title")) out.push({ kind: "clickable", detail: "button with no name: " + label(b) }); }
  for (const a of document.querySelectorAll("a[href]")) { if (/indiacode\.nic\.in/i.test(a.href)) out.push({ kind: "oldlink", detail: "link to the old India Code address: " + a.href.slice(0, 120) }); }
  for (const body of document.querySelectorAll("article .font-reading")) { const last = [...body.children].filter((c) => (c.innerText || "").trim()).pop(); if (!last) continue; const t = (last.innerText || "").trim(), letters = t.replace(/[^A-Za-z]/g, ""); if (last.tagName === "H3" || (letters.length >= 6 && letters === letters.toUpperCase() && t.split(/\s+/).length >= 2 && !/[.;:,]$/.test(t) && !/^[(\d]/.test(t))) out.push({ kind: "tailhead", detail: "section text ends with a heading line: \"" + t.slice(0, 80) + "\"" }); }
  // 5. a section we do not hold is said so in the answer: the way to read it on India Code must be on the page too
  if (/(?:isn't|is not) in our library yet|cannot quote it/.test(all) && ![...document.querySelectorAll("a[href]")].some((a) => /on India Code/i.test(a.textContent) && /^https?:/.test(a.getAttribute("href")))) out.push({ kind: "gaplink", detail: "the page says a section is not in our library, but has no \"Read ... on India Code\" link" });
  // 5b. said once, linked once: the sentence, one link, and no second telling ("I couldn't find ...") on the page
  { const says = (all.match(/in our library yet/g) || []).length, links = [...document.querySelectorAll("a[href]")].filter((a) => /on India Code/i.test(a.textContent)).length, again = /I couldn'?t find|is missing from our source data/.test(all);
    if (says > 1 || links > 1 || (says >= 1 && again)) out.push({ kind: "gaprepeat", detail: "a missing section is said " + says + " time(s), linked " + links + " time(s)" + (again ? ", and followed by a second telling (\"I couldn't find\" / \"missing from our source data\")" : "") }); }
  // 6. text that is only a table of contents must not be labelled "No problems detected"
  const looksList = (t) => { const m = [...t.matchAll(/(?:^|\s)(\d{1,3}[A-Z]{0,2})\.\s+[A-Z][^.]{1,160}\./g)]; if (m.length < 3 || m.reduce((n, x) => n + x[0].length, 0) / t.length <= 0.6) return false; const n = m.map((x) => parseInt(x[1], 10)); let g = 0; for (let i = 1; i < n.length; i++) if (n[i] - n[i - 1] === 1 || n[i] === n[i - 1]) g++; return g / (n.length - 1) >= 0.7; };
  for (const body of document.querySelectorAll("article .font-reading")) { const t = (body.innerText || "").replace(/\s+/g, " ").trim(); if (looksList(t) && /No problems detected/.test((body.closest("article") || body).innerText || "")) out.push({ kind: "listflag", detail: "a table of contents is shown as a section's text with \"No problems detected\": " + t.slice(0, 70) }); }
  out.push({ kind: "_links", detail: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/") && !h.startsWith("//")))] });
  return out;
}`;

const PAGE_CHECK = (0, eval)(IN_PAGE);   // the checks are written as text so they can be sent to the browser as they are
const raw = Object.fromEntries(Object.entries(RAW_ON_PAGE).map(([k, re]) => [k, [re.source, re.flags.replace("g", "")]]));
const old = OLD_WORDING.map((re) => [re.source, re.flags.replace("g", "")]);


// A page with one planted defect per check. If the sweep stops seeing any of them it has gone blind, and it fails before looking at the app.
const SELFTEST_HTML = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:16px sans-serif} header{position:fixed;top:0;left:0;right:0;height:60px;background:#ddd} nav.bar{position:fixed;bottom:0;left:0;right:0;height:50px;background:#ccc}
main{padding:70px 16px 0} .wide{width:2000px;height:10px;background:red} aside{position:sticky;top:20px;height:1400px;background:#eee;width:200px}
.pt{cursor:pointer} p.last{margin:0 0 -30px}</style></head><body><header>bar</header><main>
<h1>Planted defects</h1><div class="wide">wide</div>
<p>==> picture 3 omitted <==  and \u2015Man\u2016 and 4[some amended words] and &amp; and \\n and undefined</p><p>Browse Laws & Judgments in the Workspace</p>
<a href="https://www.indiacode.nic.in/handle/123/456">old address</a><article><div class="font-reading"><p>The section text.</p><h3>OF FRAUDULENT DEEDS AND DISPOSITIONS OF PROPERTY</h3></div></article>
<p>Section 375 of the Indian Penal Code isn't in our library yet. I couldn't find other sections in the Acts I searched.</p><article><span>No problems detected</span><div class="font-reading"><p>375. Rape. 376. Punishment for rape. 376A. Punishment for causing death or resulting in persistent vegetative state of victim. 376B. Sexual intercourse by husband upon his wife during separation.</p></div></article><span class="pt">looks clickable</span> <a href="#">goes nowhere</a> <a href="/nope-sweep-selftest">dead</a>
<aside>tall sticky column</aside><div style="height:1200px"></div><p class="last">last words under the bar</p></main><nav class="bar">tabs</nav></body></html>`;
async function selfTest(browser) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 700 } }), page = await ctx.newPage();
  await page.route("**/__sweep-selftest", (r) => r.fulfill({ status: 200, contentType: "text/html", body: SELFTEST_HTML }));
  await page.goto(BASE + "/__sweep-selftest"); const got = new Set((await page.evaluate(PAGE_CHECK, { raw, old })).map((f) => f.kind)); await ctx.close();
  const missing = ["hscroll", "hidden", "raw", "wording", "clickable", "oldlink", "tailhead", "gaplink", "gaprepeat", "listflag"].filter((k) => !got.has(k));
  if (missing.length) throw new Error("self-test: the sweep did not see a planted " + missing.join(", ") + " defect, so its checks are not working");
}

const isAllowed = (pageId, vp, f) => allow.some((a) => (a.page === "*" || a.page === pageId) && (!a.viewport || a.viewport === vp) && a.kind === f.kind && (!a.match || String(f.detail).toLowerCase().includes(a.match.toLowerCase())));

async function main() {
  const server = await startServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const findings = [], links = new Map(), shots = [];
  try {
    await selfTest(browser);
    const anon = await browser.newContext(); const authCtx = await browser.newContext(); const r0 = await authCtx.request.post(BASE + "/api/access/login", { data: { password: PASSWORD } });
    if (!r0.ok()) throw new Error("login failed (" + r0.status() + ")");
    const targets = await findTargets(authCtx.request); await anon.close();
    // the central Act is asked for, the central Act lacks the section: "not in our library", never a state copy's text (this is what made IPC 375 show a Chandigarh contents list)
    { const j = await (await authCtx.request.get(BASE + "/api/acts/search?q=" + encodeURIComponent("section 375 indian penal code") + "&exact=1")).json().catch(() => null);
      if (!j?.missing) findings.push({ page: "api:search", viewport: "-", kind: "lookup", detail: "'section 375 indian penal code' did not answer 'missing from our library' (got " + (j?.results?.length ?? "no") + " results)" });
      else if ((j.results ?? []).some((h) => h.category !== "central")) findings.push({ page: "api:search", viewport: "-", kind: "lookup", detail: "'section 375 indian penal code' returned a state or UT copy of the Act" }); }
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
      await ctx.request.post(BASE + "/api/access/login", { data: { password: PASSWORD } });
      const anonCtx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
      fs.mkdirSync(path.join(OUT, vp.id), { recursive: true });
      for (const pg of pages(targets)) {
        if (only && !pg.id.includes(only)) continue;
        const page = await (pg.anon ? anonCtx : ctx).newPage(), logs = [];
        page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text()) && !(pg.allowStatus && /deliberate error/.test(m.text()))) logs.push("console error: " + m.text().slice(0, 160)); });
        page.on("pageerror", (e) => logs.push("page error: " + String(e.message).slice(0, 160)));
        page.on("response", (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400 && !/\/_next\/|favicon/.test(u) && !(pg.allowStatus ?? []).includes(r.status()) && !/\/api\/(usage|chat$)/.test(u)) logs.push("request failed " + r.status() + " " + u.replace(BASE, "").slice(0, 100)); });
        const add = (kind, detail) => findings.push({ page: pg.id, viewport: vp.id, kind, detail });
        try {
          if (pg.before) await pg.before(page, vp);
          const res = await page.goto(BASE + pg.url, { waitUntil: "load", timeout: 60000 });
          if (res && res.status() >= 400 && !(pg.allowStatus ?? []).includes(res.status())) add("console", "page answered " + res.status());
          await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => null);
          await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
          if (pg.prep) await pg.prep(page, vp);
          await page.waitForTimeout(pg.wait ?? 700);
          const imgs = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getBoundingClientRect().width > 0).map((i) => i.currentSrc.slice(0, 80)));
          for (const i of imgs) add("console", "broken image " + i);
          const res2 = await page.evaluate(PAGE_CHECK, { raw, old });
          for (const f of res2) { if (f.kind === "_links") for (const h of f.detail) { if (!links.has(h)) links.set(h, `${pg.id}@${vp.id}`); } else add(f.kind, f.detail); }
          if (pg.forbid) { const txt = await page.evaluate(() => (document.querySelector("main") || document.body).innerText); for (const [re, why] of pg.forbid) { const m = re.exec(txt); if (m) add("raw", why + ": ..." + txt.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, " ") + "..."); } }
          for (const l of logs) add("console", l);
          if (!noShots) { const file = path.join(OUT, vp.id, pg.id + ".png"); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: file }); shots.push(file); }
        } catch (e) { add("console", "sweep could not finish this page: " + String(e.message).split("\n")[0].slice(0, 200)); }
        await page.close();
      }
      await ctx.close(); await anonCtx.close();
    }
    // links that lead to an error: every distinct address in the pages above, opened once (signed in)
    // hundreds of addresses are the same kind of page (one law, one case): open 3 of each kind, plus every address of the fixed pages
    const skip = /^\/api\/|^\/_next\//, bad = [], kindOf = (h) => { const u = new URL(h, BASE); return u.pathname.split("/").map((s) => (/\d|_|%/.test(s) || s.length > 24 ? ":" : s)).join("/") + "?" + [...u.searchParams.keys()].sort().join("&"); };
    const seen = new Map(), todo = [];
    for (const [href, from] of links) { if (skip.test(href)) continue; const k = kindOf(href), n = seen.get(k) ?? 0; seen.set(k, n + 1); if (n < 3) todo.push([href, from]); }
    console.log(`opening ${todo.length} of ${[...links.keys()].filter((h) => !skip.test(h)).length} distinct links (3 of each kind of page) ...`);
    for (const [href, from] of todo) {
      const res = await authCtx.request.get(BASE + href, { maxRedirects: 5, timeout: 25000 }).catch(() => null);
      if (!res || res.status() >= 400) bad.push({ page: from.split("@")[0], viewport: from.split("@")[1], kind: "clickable", detail: `link ${href} leads to ${res ? res.status() : "no answer in 25 s"}` });
    }
    findings.push(...bad);
    const checkedLinks = todo.length;
    const open = findings.filter((f) => !isAllowed(f.page, f.viewport, f)), allowed = findings.length - open.length;
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ when: new Date().toISOString(), pages: pages(targets).length, viewports: VIEWPORTS.map((v) => v.id), linksChecked: checkedLinks, found: open, allowed: allowed }, null, 1));
    const by = {}; for (const f of open) (by[f.kind] ??= []).push(f);
    console.log(`\nUI sweep: ${pages(targets).filter((p) => !only || p.id.includes(only)).length} page types x ${VIEWPORTS.length} viewports, ${checkedLinks} distinct links opened; ${open.length} finding(s), ${allowed} allowed (scripts/ui-sweep/allow.json)`);
    for (const [k, list] of Object.entries(by)) { console.log(`\n== ${k} (${list.length})`); for (const f of list) console.log(`  [${f.viewport}] ${f.page}: ${f.detail}`); }
    if (!open.length) console.log("\nClean.");
    process.exitCode = open.length ? 1 : 0;
  } finally {
    await browser.close();
    if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } }
  }
}
main().catch((e) => { console.error("ui-sweep failed:", e.message); process.exit(2); });
