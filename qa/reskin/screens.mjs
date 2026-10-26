// Phase 2 screenshots: the seven key screens at 1280 and 375 px, from a site on <base> using the FIXED fixture browser id (qa/reskin/fixtures.mjs), saved as docs/screenshots/reskin-phase2/<screen>-<width>-<label>.png.
// usage: ACCESS_PW=... node --experimental-websocket qa/reskin/screens.mjs <before|after> <base>
import fs from "node:fs";
import { launch } from "./cdp.mjs";
const [, , label = "after", BASE = "http://localhost:3100"] = process.argv, OUT = "docs/screenshots/reskin-phase2", BID = "reskinfixtures00000000001";
fs.mkdirSync(OUT, { recursive: true });
const fx = JSON.parse(fs.readFileSync("../lexbharat-data/reskin-fixtures.json", "utf8"));
const SCREENS = [
  ["01-dashboard", "/workspace"], ["02-chat-answer", `/workspace/chat/${fx.chat}`], ["03-act-selected-section", "/workspace/browse/acts/IND_central_2189?section=s138"],
  ["04-sc-judgment", "/workspace/browse/judgments/supreme-court-of-india/2005/2005_INSC_103#fulltext"], ["05-drafting-editor", `/workspace/drafting/${fx.draft}`],
  ["06-review-result", `/workspace/review/${fx.review}`], ["07-vault-list", "/workspace/vault"],
];
const lg = await fetch(BASE + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ACCESS_PW }) });
const cookies = lg.headers.getSetCookie().map((c) => c.split(";")[0]);
const host = new URL(BASE).hostname, c = await launch(9363);
for (const [w, h] of [[1280, 900], [375, 812]]) {
  await c.view(w, h);
  for (const [name, p] of SCREENS) {
    await c.send("Network.clearBrowserCookies");
    for (const kv of [...cookies, `lb_bid=${BID}`]) { const i = kv.indexOf("="); await c.cookie(kv.slice(0, i), kv.slice(i + 1), host); }
    await c.go(BASE + p, 3500);
    await c.js(`(async () => { for (let y = 0; y < Math.min(document.body.scrollHeight, 4000); y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300)); })()`);
    fs.writeFileSync(`${OUT}/${name}-${w}-${label}.png`, await c.shot(3200)); console.log(name, w, label, await c.js("document.documentElement.scrollHeight"));
  }
}
c.close();
