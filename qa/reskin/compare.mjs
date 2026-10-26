// Reskin check, step 2: compare two snapshot folders made by snap.mjs. Reports, per page and width: element count, computed-style differences (any property of any element), and the pixel difference
// (pixelmatch, threshold 0). PASS only when everything is identical. usage: node qa/reskin/compare.mjs <A> <B> [--ignore <file with "page@w" lines>]
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/tmp/reskin-tools/");
const { PNG } = require("pngjs"), pixelmatch = require("pixelmatch").default ?? require("pixelmatch");
const [, , A, B] = process.argv, dirA = `../lexbharat-data/reskin-snaps/${A}`, dirB = `../lexbharat-data/reskin-snaps/${B}`;
const names = fs.readdirSync(dirA).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
let bad = 0; const rows = [];
for (const n of names) {
  if (!fs.existsSync(`${dirB}/${n}.json`)) { rows.push([n, "MISSING in B"]); bad++; continue; }
  const a = JSON.parse(fs.readFileSync(`${dirA}/${n}.json`, "utf8")), b = JSON.parse(fs.readFileSync(`${dirB}/${n}.json`, "utf8"));
  let diffs = 0, first = [];
  if (a.n !== b.n) { diffs = Math.abs(a.n - b.n); first.push(`element count ${a.n} vs ${b.n}`); }
  else for (let i = 0; i < a.n; i++) { const x = a.els[i], y = b.els[i]; for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) { diffs++; if (first.length < 3) first.push(`#${i} <${x.t}> "${x.x}" ${k}: ${JSON.stringify(x[k]).slice(0, 50)} -> ${JSON.stringify(y[k]).slice(0, 50)}`); } }
  let px = -1;
  try { const pa = PNG.sync.read(fs.readFileSync(`${dirA}/${n}.png`)), pb = PNG.sync.read(fs.readFileSync(`${dirB}/${n}.png`)); if (pa.width === pb.width && pa.height === pb.height) px = pixelmatch(pa.data, pb.data, null, pa.width, pa.height, { threshold: 0 }); else first.push(`image size ${pa.width}x${pa.height} vs ${pb.width}x${pb.height}`); } catch (e) { first.push("png: " + e.message); }
  const ok = diffs === 0 && px === 0; if (!ok) bad++;
  rows.push([n, ok ? "same" : "DIFF", `styleDiffs=${diffs}`, `pixels=${px}`, ...first]);
}
for (const r of rows) console.log(r.join(" | "));
console.log(bad ? `\n${bad} of ${names.length} differ` : `\nPASS: all ${names.length} page/width snapshots identical (computed styles and pixels)`);
process.exit(bad ? 1 : 0);
