// Accessibility pass with axe-core (WCAG 2.x A/AA) on the key screens at 1280 and 375 px. Prints violations per page (rule, count, first element). usage: ACCESS_PW=... node --experimental-websocket qa/reskin/axe.mjs [base]
import fs from "node:fs";
import { createRequire } from "node:module";
import { launch } from "./cdp.mjs";
const require = createRequire("/tmp/reskin-tools/"), axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const BASE = process.argv[2] ?? "http://localhost:3100", BID = "reskinfixtures00000000001", fx = JSON.parse(fs.readFileSync("../lexbharat-data/reskin-fixtures.json", "utf8"));
const PAGES = [["dashboard", "/workspace"], ["browse", "/workspace/browse"], ["acts-tab", "/workspace/browse?tab=acts"], ["act-section", "/workspace/browse/acts/IND_central_2189?section=s138"], ["sc-court", "/workspace/browse/judgments/supreme-court-of-india"],
  ["sc-case", "/workspace/browse/judgments/supreme-court-of-india/2005/2005_INSC_103"], ["chat", `/workspace/chat/${fx.chat}`], ["drafting", `/workspace/drafting/${fx.draft}`], ["review", `/workspace/review/${fx.review}`], ["vault", "/workspace/vault"], ["home", "/"], ["docs", "/docs"]];
const lg = await fetch(BASE + "/api/access/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: process.env.ACCESS_PW }) });
const cookies = lg.headers.getSetCookie().map((c) => c.split(";")[0]), c = await launch(9364); let total = 0;
for (const [w, h] of [[1280, 900], [375, 812]]) {
  await c.view(w, h);
  for (const [name, p] of PAGES) {
    await c.send("Network.clearBrowserCookies");
    for (const kv of [...cookies, `lb_bid=${BID}`]) { const i = kv.indexOf("="); await c.cookie(kv.slice(0, i), kv.slice(i + 1)); }
    await c.go(BASE + p, 3000);
    await c.js(axeSrc);
    const r = await c.js(`axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }).then((x) => x.violations.map((v) => ({ id: v.id, n: v.nodes.length, impact: v.impact, first: v.nodes[0]?.target?.join(" ").slice(0, 90), note: (v.nodes[0]?.any?.[0]?.message || v.nodes[0]?.failureSummary || "").slice(0, 120) })))`);
    total += r.length; console.log(`${w} ${name}: ${r.length ? r.map((v) => `${v.id}×${v.n} (${v.impact}) ${v.first} — ${v.note}`).join(" || ") : "no violations"}`);
  }
}
console.log(`\nviolation rules in total: ${total}`); c.close();
