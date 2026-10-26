// Reskin check, step 1: snapshot a running site (production build on :3100 with throwaway passwords) to ../lexbharat-data/reskin-snaps/<label>/:
//   <page>@<width>.png    whole-page screenshot (height capped at 7000 px)
//   <page>@<width>.json   every element under <body>: tag, short text, rounded box, and ~40 computed style properties
// usage: ACCESS_PW=... ADMIN_PW=... node --experimental-websocket qa/reskin/snap.mjs <label> [base=http://localhost:3100]
import fs from "node:fs";
import { launch } from "./cdp.mjs";

const [, , label = "baseline", BASE = "http://localhost:3100"] = process.argv, OUT = `../lexbharat-data/reskin-snaps/${label}`;
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [
  ["home", "/"], ["about", "/about"], ["contact", "/contact"], ["security", "/security"], ["for-lawyers", "/for-lawyers"], ["playground", "/playground"], ["brand", "/brand"], ["blog", "/blog"],
  ["customer", "/customer"], ["clauses", "/clauses"], ["topics", "/topics"], ["legal-api", "/legal-api"], ["open-us-law", "/open-us-law"], ["support", "/support"], ["privacy", "/privacy"], ["terms", "/terms"],
  ["docs", "/docs"], ["docs-page", "/docs/introduction"], ["developer", "/developer"], ["auth-login", "/auth/login"], ["not-found", "/this-page-does-not-exist"], ["access", "/access", { noCookie: true }],
  ["workspace", "/workspace"], ["browse", "/workspace/browse"], ["browse-acts", "/workspace/browse?tab=acts"], ["act-ni", "/workspace/browse/acts/IND_central_2189"], ["act-ni-s138", "/workspace/browse/acts/IND_central_2189?section=s138"],
  ["act-coi-a21", "/workspace/browse/acts/IND_central_COI?section=sA21"], ["act-regulator", "/workspace/browse/acts/REG_DGFT_cottonyarn"],
  ["sc-court", "/workspace/browse/judgments/supreme-court-of-india"], ["sc-year", "/workspace/browse/judgments/supreme-court-of-india?year=2015"], ["sc-case-short", "/workspace/browse/judgments/supreme-court-of-india/2005/2005_INSC_103"],
  ["sc-case-long", "/workspace/browse/judgments/supreme-court-of-india/2025/2025_INSC_445"], ["hc-court", "/workspace/browse/judgments/delhi-high-court"], ["hc-year", "/workspace/browse/judgments/delhi-high-court?year=2015"],
  ["chat", "/workspace/chat"], ["drafting", "/workspace/drafting"], ["review", "/workspace/review"], ["vault", "/workspace/vault"], ["admin-login", "/admin/insights", { noCookie: true }], ["admin", "/admin/insights", { admin: true }],
];
const WIDTHS = [[1280, 900], [375, 812]], ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;   // ONLY=home,about re-snapshots just those pages
const PROPS = ["display", "position", "fontSize", "fontFamily", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform", "textDecorationLine", "textAlign", "color", "backgroundColor", "backgroundImage",
  "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius",
  "boxShadow", "opacity", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft", "maxWidth", "minWidth", "width", "height", "gap", "zIndex", "overflowX", "outlineColor", "fill", "stroke", "strokeWidth", "caretColor", "accentColor", "textDecorationColor", "borderImageSource"];
const DUMP = `(() => { const P = ${JSON.stringify(PROPS)}; const out = []; for (const e of document.body.querySelectorAll("*")) { if (e.closest("nextjs-portal, script, style")) continue; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); const o = { t: e.tagName.toLowerCase(), x: (e.childNodes.length && [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 24)) || "", r: [Math.round(r.x), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)] }; for (const p of P) o[p] = cs[p]; out.push(o); } return out; })()`;

async function login(path, pw) { const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) }); return r.headers.getSetCookie().map((c) => c.split(";")[0]); }
const access = await login("/api/access/login", process.env.ACCESS_PW), admin = await login("/api/admin/login", process.env.ADMIN_PW);
if (!access.length) throw new Error("access login failed");
const c = await launch(9362);
for (const [w, h] of WIDTHS) {
  await c.view(w, h);
  for (const [name, p, o = {}] of PAGES) {
    if (ONLY && !ONLY.includes(name)) continue;
    await c.send("Network.clearBrowserCookies");
    if (!o.noCookie) for (const kv of [...access, ...(o.admin ? admin : [])]) { const i = kv.indexOf("="); await c.cookie(kv.slice(0, i), kv.slice(i + 1)); }
    await c.go(BASE + p, 3000);
    await c.js("(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400)); })()");
    await c.js(`(() => { const s = document.createElement("style"); s.textContent = "*,*::before,*::after{animation:none !important;transition:none !important;scroll-behavior:auto !important}"; document.head.appendChild(s); })()`);   // freeze the testimonial marquee and any animation so snapshots are repeatable
    await c.sleep(300);
    const dump = await c.js(DUMP), png = await c.shot(7000), url = await c.js("location.pathname");
    fs.writeFileSync(`${OUT}/${name}@${w}.png`, png); fs.writeFileSync(`${OUT}/${name}@${w}.json`, JSON.stringify({ url, n: dump.length, els: dump }));
    console.log(w, name, url, dump.length, "elements");
  }
}
c.close();
