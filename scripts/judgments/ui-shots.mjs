// Screenshots of the search/filter/top-bar surfaces in headless Chrome (DevTools protocol, no dependencies). Usage:
//   node --experimental-websocket scripts/judgments/ui-shots.mjs <before|after> [base=http://localhost:3100]
import { spawn } from "node:child_process"; import { tmpdir } from "node:os"; import path from "node:path"; import fs from "node:fs";
const [, , phase = "after", BASE = "http://localhost:3100"] = process.argv, OUT = path.join("docs/screenshots/ui-search-topbar", phase); fs.mkdirSync(OUT, { recursive: true });
const PORT = 9347, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "ui-shots-profile")}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const view = (w, h, mobile) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
const shot = async (name) => { const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, "base64")); console.log("saved", name); };
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(2500); };
const click = (sel) => js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})][0]; if(!e) return false; e.click(); return true})()`);
const clickText = (t, sel = "button,[role=tab]") => js(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>b.textContent.trim().startsWith(${JSON.stringify(t)})); if(!e) return false; e.click(); return true})()`);
const selectVal = (id, v) => js(`(()=>{const s=document.getElementById(${JSON.stringify(id)}); if(!s) return false; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,${JSON.stringify(v)}); s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
await send("Page.enable"); await view(1280, 800);
await go("/workspace/browse"); await shot("01-browse-judgments");
await clickText("Acts"); await sleep(1500); await selectVal("f-status", "repealed"); await sleep(1500); await shot("02-browse-acts-filter-changed");
await go("/workspace/browse/judgments/bombay-high-court"); await shot("03-court-page");
await go("/workspace/browse/judgments/supreme-court-of-india?year=2025"); await sleep(1500); await shot("04-court-year-page");
if (phase === "after") {
  await go("/workspace/browse"); await clickText("Legal Data", "button[aria-haspopup]") || await js(`document.querySelector('[data-testid=product-switcher]')?.click()`); await sleep(400); await shot("05-product-dropdown");
  await go("/workspace/browse"); await js(`document.querySelector('[data-testid=country-switcher]')?.click()`); await sleep(400); await shot("06-country-dropdown");
}
await view(375, 812, true); await go("/workspace/browse"); await shot("07-phone-browse");
await clickText("Acts"); await sleep(1500); await selectVal("f-status", "repealed"); await sleep(1200); await js(`document.getElementById("f-cat")?.scrollIntoView({block:"start"})`); await sleep(300); await shot("08-phone-acts-filter");
await go("/workspace/browse/judgments/supreme-court-of-india?year=2025"); await sleep(1200); await shot("09-phone-court-year");
if (phase === "after") { await go("/workspace/browse"); await js(`document.querySelector('[data-testid=product-switcher]')?.click()`); await sleep(400); await shot("10-phone-product-dropdown"); }
chrome.kill(); process.exit(0);
