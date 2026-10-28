// Screenshots of the new shell in its different states (Quick-find open, the menu, the Feedback form, the phone tab bar hiding on a reading page). Saved in docs/screenshots/<phase>/.
// Usage: SHOTS_PASSWORD=... node --experimental-websocket scripts/reskin/shell-shots.mjs <phase> [base=http://localhost:3100]
import { spawn } from "node:child_process"; import { tmpdir } from "node:os"; import path from "node:path"; import fs from "node:fs";
const [, , phase = "phase2", BASE = "http://localhost:3100"] = process.argv, OUT = path.join("docs/screenshots", phase); fs.mkdirSync(OUT, { recursive: true });
const PORT = 9355, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), ACT = "/law/IND_central_2189/s138";
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "reskin-shell-shots")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
const go = async (p) => { await send("Page.navigate", { url: BASE + p }); await sleep(1600); await ev("document.fonts.ready.then(() => 1)"); };
const shoot = async (name, w, h, mobile, full = false) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }); await sleep(150);
  const ph = await ev("Math.max(document.documentElement.scrollHeight, innerHeight)"), sy = full ? 0 : await ev("window.scrollY"); const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: { x: 0, y: sy, width: w, height: full ? Math.min(ph, 1500) : h, scale: 1 } });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(shot.result.data, "base64")); console.log(name); };
const typeInto = (sel, text) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set; set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event("input", { bubbles: true })); })()`);
const click = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.click()`);
await send("Page.enable");
for (const [label, w, h, mobile] of [["desktop", 1280, 860, false], ["phone", 375, 812, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await go("/access"); await ev(`fetch("/api/access/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:${JSON.stringify(process.env.SHOTS_PASSWORD ?? "")}})}).then(r=>r.status)`);
  for (const [name, p] of [["desk", "/"], ["ask", "/ask"], ["search", "/search"], ["library", "/library"], ["law", ACT], ["work-drafts", "/work/drafts"], ["work-reviews", "/work/reviews"], ["work-documents", "/work/vault"]]) { await go(p); await shoot(`${name}-${label}`, w, h, mobile, label === "desktop"); }
  // Quick-find
  await go("/ask"); await ev(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }))`); await sleep(400); await typeInto('[role="combobox"]', "138 NI Act"); await sleep(2200); await shoot(`quickfind-${label}`, w, h, mobile);
  await typeInto('[role="combobox"]', "cheque"); await sleep(2200); await shoot(`quickfind-work-${label}`, w, h, mobile);
  // menu and feedback
  await go("/"); await click('button[aria-label^="Menu: Feedback"]'); await sleep(300); await shoot(`menu-${label}`, w, h, mobile);
  await click('[role="menuitem"]'); await sleep(400); await typeInto("textarea", "The search for section 138 worked well. Could Library show the Constitution?"); await shoot(`feedback-${label}`, w, h, mobile);
  if (label === "desktop") {   // the testing banner stays fully visible under the sticky top bar while a long page scrolls
    await go(ACT); await ev("window.scrollTo(0, 900)"); await sleep(500); await shoot("law-scrolled-desktop", w, h, mobile);
  }
  if (label === "phone") {   // the tab bar leaves while scrolling down a law and returns when scrolling up; the banner scrolls away cleanly
    await go(ACT); await ev("window.scrollTo(0, 700)"); await sleep(600); await shoot("law-scrolled-down-phone", w, h, mobile);
    await ev("window.scrollTo(0, 520)"); await sleep(600); await shoot("law-scrolled-up-phone", w, h, mobile);
  }
  await send("Network.clearBrowserCookies");
}
ws.close(); chrome.kill();
