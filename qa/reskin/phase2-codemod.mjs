// Reskin Phase 2 codemod: gives controls their own shape and outline tokens, by role, inside class strings.
//   buttons  (string has "ring-1 ring-border" and "hover:bg-accent")                 rounded-panel -> rounded-button, ring-border -> ring-control-border   (outline of a control must be >= 3:1)
//   inputs   (string has "bg-surface", "ring-1 ring-border" and "focus")               rounded-panel -> rounded-input,  ring-border -> ring-control-border
//   cards    (string has "rounded-panel border border-border bg-surface p-")           rounded-panel -> rounded-card
//   chips    (string has "rounded-panel bg-accent px-2 py-0.5")                       rounded-panel -> rounded-chip
// usage: node qa/reskin/phase2-codemod.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
const APPLY = process.argv.includes("--apply"), files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.tsx$/.test(f.name)) files.push(p); } })("src");
const counts = {};
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);
function fix(str) {
  let s = str;
  if (/ring-1 ring-border\b/.test(s) && /hover:bg-accent/.test(s)) { if (/rounded-panel/.test(s)) { s = s.replace(/rounded-panel/g, "rounded-button"); bump("button shape"); } s = s.replace(/ring-1 ring-border\b/g, "ring-1 ring-control-border"); bump("button outline"); }
  else if (/bg-surface/.test(s) && /ring-1 ring-border\b/.test(s) && /focus/.test(s)) { if (/rounded-panel/.test(s)) { s = s.replace(/rounded-panel/g, "rounded-input"); bump("input shape"); } s = s.replace(/ring-1 ring-border\b/g, "ring-1 ring-control-border"); bump("input outline"); }
  if (/rounded-panel border border-border bg-surface p-/.test(s)) { s = s.replace(/rounded-panel(?= border border-border bg-surface p-)/g, "rounded-card"); bump("card"); }
  if (/rounded-panel bg-accent px-2 py-0\.5/.test(s)) { s = s.replace(/rounded-panel(?= bg-accent px-2 py-0\.5)/g, "rounded-chip"); bump("chip"); }
  return s;
}
let changed = 0;
for (const f of files) {
  const a = fs.readFileSync(f, "utf8");
  const b = a.replace(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (m, q, body) => { const n = /rounded-|ring-/.test(body) ? fix(body) : body; return n === body ? m : q + n + q; });
  if (a !== b) { changed++; if (APPLY) fs.writeFileSync(f, b); }
}
console.log(JSON.stringify({ filesChanged: changed, counts }));
