// Screenshots of the static mock-ups (docs/mockups/*.html) at desktop (1280 px, the whole page up to 1500 px) and phone (375 px, the first 812 px screen as a phone shows it, with the fixed tab bar), saved next to them as <name>-desktop.png and <name>-phone.png.
// Headless Chrome over the DevTools protocol, no dependencies. Usage: node --experimental-websocket scripts/reskin/shots.mjs
import { spawn } from "node:child_process"; import http from "node:http"; import { tmpdir } from "node:os"; import path from "node:path"; import fs from "node:fs";
const ROOT = process.cwd(), PORT = 9351, WEB = 3199, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { ".html": "text/html", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp", ".json": "application/json" };
const srv = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split("?")[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "application/octet-stream" }); fs.createReadStream(f).pipe(res); }).listen(WEB);
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(tmpdir(), "reskin-shots")}`, "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
let ver; for (let i = 0; i < 50 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch { await sleep(200); } }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const names = fs.readdirSync("docs/mockups").filter((f) => f.endsWith(".html")).map((f) => f.slice(0, -5)), EXTRA = { phone: [["ask-sheet", "ask.html#page"]] };   // the phone sheet is closed until a citation chip is tapped, so it gets its own shot
for (const [label, width, height, mobile] of [["desktop", 1280, 860, false], ["phone", 375, 812, true]]) {
  for (const n of [...names, ...(EXTRA[label] ?? []).map(([k]) => k)]) {
    const page = (EXTRA[label] ?? []).find(([k]) => k === n)?.[1] ?? `${n}.html`;
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile });
    await send("Page.navigate", { url: `http://localhost:${WEB}/docs/mockups/${page}` }); await sleep(900);
    await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true });
    const h = (await send("Runtime.evaluate", { expression: "Math.max(document.documentElement.scrollHeight, innerHeight)", returnByValue: true })).result.result.value;
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: label === "desktop", clip: { x: 0, y: 0, width, height: label === "phone" ? height : Math.min(h, 1500), scale: 1 } });
    fs.writeFileSync(`docs/mockups/${n}-${label}.png`, Buffer.from(shot.result.data, "base64")); console.log(`${n}-${label}.png`, width, "x", h);
  }
}
ws.close(); chrome.kill(); srv.close();
