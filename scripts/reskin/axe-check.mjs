// Runs axe-core (WCAG 2 A and AA, plus best practice) on the app's pages and shell states in headless Chrome and prints every violation. axe is NOT a project dependency: give it as AXE_JS=/path/to/axe.min.js.
// Usage: SHOTS_PASSWORD=... AXE_JS=... node --experimental-websocket scripts/reskin/axe-check.mjs [base=http://localhost:3100]
import { spawn } from "node:child_process"; import { tmpdir } from "node:os"; import path from "node:path"; import fs from "node:fs";
const BASE = process.argv[2] ?? "http://localhost:3100", AXE = fs.readFileSync(process.env.AXE_JS, "utf8"), PORT = 9357, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "reskin-axe")}`, "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json(); const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1800); };
const typeInto = (sel, text) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set; set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const run = async (label) => { const res = await ev(`(async () => { if (!window.axe) { const s = document.createElement("script"); s.textContent = ${JSON.stringify(AXE)}; document.head.appendChild(s); } const r = await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0].html.slice(0, 140), target: v.nodes[0].target.join(" ") })); })()`);
  console.log(`${label}: ${res.length ? res.length + " violation(s)" : "no violations"}`); for (const v of res) console.log(`   [${v.impact}] ${v.id} x${v.n}: ${v.help}\n      ${v.target}\n      ${v.sample}`); return res.length; };
let bad = 0; await send("Page.enable");
for (const [label, w, h, mobile] of [["desktop", 1280, 860, false], ["phone", 375, 812, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await go("/access"); await ev(`fetch("/api/access/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:${JSON.stringify(process.env.SHOTS_PASSWORD ?? "")}})}).then(r=>r.status)`);
  for (const [name, p] of [["workspace", "/workspace"], ["chat", "/workspace/chat"], ["browse", "/workspace/browse"], ["law", "/workspace/browse/acts/IND_central_2189?section=s138"], ["drafting", "/workspace/drafting"], ["review", "/workspace/review"], ["vault", "/workspace/vault"]]) { await go(p); bad += await run(`${name} ${label}`); }
  await go("/workspace"); await ev(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))`); await sleep(400); await typeInto('[role="combobox"]', "138 NI Act"); await sleep(2200); bad += await run(`quick-find open ${label}`);
  await go("/workspace"); await ev(`document.querySelector('button[aria-label^="Menu: Feedback"]').click()`); await sleep(300); bad += await run(`menu open ${label}`);
  await ev(`document.querySelector('[role="menuitem"]').click()`); await sleep(400); bad += await run(`feedback dialog ${label}`);
  await send("Network.clearBrowserCookies");
}
console.log(bad ? `\nTOTAL violations across states: ${bad}` : "\nNo violations in any state."); ws.close(); chrome.kill();
