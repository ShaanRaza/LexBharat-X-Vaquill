// Phase 3 screenshots of the shell (top bar, sidebar, mobile drawer, banner, password page) at 1280 and 375 px -> docs/screenshots/reskin-phase3/<name>-<width>-<label>.png
// usage: ACCESS_PW=... node --experimental-websocket qa/reskin/shell-shots.mjs <before|after> <base for the gated site> [base of a dev server started with an EMPTY ACCESS_PASSWORD, for the banner]
import fs from "node:fs";
import { launch } from "./cdp.mjs";
const [, , label = "after", BASE = "http://localhost:3100", OPEN = ""] = process.argv, OUT = "docs/screenshots/reskin-phase3", BID = "reskinfixtures00000000001";
fs.mkdirSync(OUT, { recursive: true });
const lg = await fetch(BASE + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ACCESS_PW }) });
const cookies = lg.headers.getSetCookie().map((c) => c.split(";")[0]), c = await launch(9365);
const click = (sel) => c.js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; e.click(); return true; })()`);
const shot = async (name, w) => { fs.writeFileSync(`${OUT}/${name}-${w}-${label}.png`, await c.shot(1400)); console.log(name, w); };
async function login(base) { await c.send("Network.clearBrowserCookies"); const host = new URL(base).hostname; for (const kv of [...cookies, `lb_bid=${BID}`]) { const i = kv.indexOf("="); await c.cookie(kv.slice(0, i), kv.slice(i + 1), host); } }
for (const [w, h] of [[1280, 800], [375, 812]]) {
  await c.view(w, h);
  await login(BASE); await c.go(BASE + "/workspace", 3000); await shot("01-dashboard-shell", w);
  if (w >= 768) { await c.go(BASE + "/developer?tab=overview", 3000); await shot("01b-data-api-shell", w); await c.go(BASE + "/workspace", 2500); }
  if (w >= 768) { await click('[data-testid="product-switcher"]'); await c.sleep(400); await shot("02-product-menu", w); }
  else { await click('button[aria-label="Open menu"]'); await c.sleep(600); await shot("03-mobile-drawer-open", w); }
  await c.send("Network.clearBrowserCookies"); await c.go(BASE + "/access", 2500); await shot("04-password-page", w);
  await c.js(`(() => { const i = document.getElementById("access-pw"); if (!i) return; i.focus(); })()`); await c.sleep(300); await shot("05-password-focus", w);
  if (OPEN) { await c.send("Network.clearBrowserCookies"); await c.go(OPEN + "/workspace", 5000); await shot("06-dev-banner", w); }
}
c.close();
