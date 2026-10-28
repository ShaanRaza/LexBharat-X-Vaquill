// Screenshots of the RUNNING app (desktop 1280 px and phone 375 px) for a phase review, saved in docs/screenshots/<phase>/. Signs in with the password in SHOTS_PASSWORD (use a throwaway one on a local server).
// Usage: SHOTS_PASSWORD=... node --experimental-websocket scripts/reskin/app-shots.mjs <phase> [base=http://localhost:3100]
import { spawn } from "node:child_process"; import { tmpdir } from "node:os"; import path from "node:path"; import fs from "node:fs";
const [, , phase = "phase1", BASE = "http://localhost:3100"] = process.argv, OUT = path.join("docs/screenshots", phase); fs.mkdirSync(OUT, { recursive: true });
const PORT = 9353, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PAGES = [["access", "/access", false], ["workspace", "/", true], ["chat", "/ask", true], ["browse", "/library", true], ["law", "/law/IND_central_2189/138", true],
  ["vault", "/work/vault", true], ["review", "/work/reviews", true], ["drafting", "/work/drafts", true], ["privacy", "/privacy", true], ["notfound", "/this-page-does-not-exist", true]];
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "reskin-app-shots")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const go = async (url) => { await send("Page.navigate", { url }); await sleep(1500); await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true }); };
const shoot = async (name, label, width, height, mobile, full) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  const h = (await send("Runtime.evaluate", { expression: "Math.max(document.documentElement.scrollHeight, innerHeight)", returnByValue: true })).result.result.value;
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, clip: { x: 0, y: 0, width, height: full ? Math.min(h, 1700) : height, scale: 1 } });
  fs.writeFileSync(path.join(OUT, `${name}-${label}.png`), Buffer.from(shot.result.data, "base64"));
};
await send("Page.enable");
for (const [label, w, h, mobile] of [["desktop", 1280, 860, false], ["phone", 375, 812, true]]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
  await go(`${BASE}/access`); if (label === "desktop") await shoot("access", label, w, h, mobile, false); else await shoot("access", label, w, h, mobile, false);
  await send("Runtime.evaluate", { expression: `fetch("/api/access/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:${JSON.stringify(process.env.SHOTS_PASSWORD ?? "")}})}).then(r=>r.status)`, awaitPromise: true, returnByValue: true });
  for (const [name, p, authed] of PAGES) { if (name === "access") continue; await go(BASE + p); await shoot(name, label, w, h, mobile, label === "desktop"); console.log(`${name}-${label}`); }
  await send("Network.clearBrowserCookies");
}
ws.close(); chrome.kill();
