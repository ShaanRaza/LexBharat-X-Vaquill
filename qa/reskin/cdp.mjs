// Minimal headless-Chrome driver over the DevTools protocol (Node built-ins only; run with node --experimental-websocket on Node 20). Used by the reskin checks. Lives in qa/, not scripts/.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function launch(port = 9360) {
  const dir = mkdtempSync(path.join(tmpdir(), "reskin-chrome-"));
  const proc = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-color-profile=srgb", "--font-render-hinting=none", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "about:blank"], { stdio: "ignore" });
  let ver; for (let i = 0; i < 60 && !ver; i++) { try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(200); } }
  if (!ver) throw new Error("Chrome did not start");
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
  await send("Page.enable"); await send("Network.enable");
  return {
    send, js, sleep,
    view: (w, h, mobile = w < 500) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile }),
    cookie: (name, value, domain = "localhost") => send("Network.setCookie", { name, value, domain, path: "/" }),
    async go(url, wait = 2500) { await send("Page.navigate", { url }); await sleep(wait); await js("document.fonts && document.fonts.ready.then(() => 1)"); },
    /** PNG of the whole page (height capped) as a Buffer. */
    async shot(maxH = 7000) {
      const h = Math.min(maxH, Math.ceil(await js("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)"))), w = await js("innerWidth");
      const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
      return Buffer.from(r.result.data, "base64");
    },
    close() { try { ws.close(); } catch {} proc.kill(); try { rmSync(dir, { recursive: true, force: true }); } catch {} },
  };
}
