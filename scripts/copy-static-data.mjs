#!/usr/bin/env node
// Copies the large data files that the app reads at run time into public/data/, so the CDN serves them as static files instead of every server function
// carrying its own copy (that cost hundreds of MB of Vercel Function Storage per deploy). The files in src/data stay the source of truth for the export scripts.
// Runs automatically before dev, build and start (package.json). public/data is generated and not committed.
import fs from "node:fs";
import path from "node:path";

const out = (p) => path.join("public/data", p);
const put = (from, to) => {
  fs.mkdirSync(path.dirname(out(to)), { recursive: true });
  if (fs.existsSync(out(to)) && fs.statSync(out(to)).size === fs.statSync(from).size && fs.statSync(out(to)).mtimeMs >= fs.statSync(from).mtimeMs) return 0;
  fs.copyFileSync(from, out(to)); return 1;
};
let n = 0;
const sc = "src/data/judgments/sc";
for (const f of fs.readdirSync(sc).filter((x) => x.endsWith(".json"))) n += put(path.join(sc, f), `judgments/sc/${f}`);
// the cross-year Supreme Court search index is a JSON string inside a generated .ts file: write it as plain JSON
const gen = fs.readFileSync("src/data/judgments/sc-index.generated.ts", "utf8"), lit = gen.slice(gen.indexOf('= "') + 2, gen.lastIndexOf('";') + 1);
const json = JSON.parse(lit);
if (!fs.existsSync(out("judgments/sc-index.json")) || fs.readFileSync(out("judgments/sc-index.json"), "utf8") !== json) { fs.mkdirSync(path.dirname(out("judgments/sc-index.json")), { recursive: true }); fs.writeFileSync(out("judgments/sc-index.json"), json); n++; }
for (const f of ["acts.legislation.json", "acts.regulations.json"]) n += put(path.join("src/data/acts", f), `acts/${f}`);
console.log(`public/data: ${n} file(s) updated`);
