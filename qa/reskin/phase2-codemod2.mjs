// Reskin Phase 2, second pass (workspace, console and kit only): finishes the shapes of buttons, cards and chips that used Tailwind's default radii.
import fs from "node:fs";
import path from "node:path";
const files = []; for (const d of ["src/components/workspace", "src/components/console", "src/components/kit", "src/app/(console)"]) (function walk(x) { for (const f of fs.readdirSync(x, { withFileTypes: true })) { const p = path.join(x, f.name); if (f.isDirectory()) walk(p); else if (/\.tsx$/.test(f.name)) files.push(p); } })(d);
const counts = {}; const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);
const R = /rounded-(panel|lg|xl|md|2xl)\b/;
function fix(s) {
  if (!R.test(s)) return s;
  if (/\bbg-primary\b/.test(s) && /text-(on-primary|white)/.test(s)) { bump("filled button"); return s.replace(R, "rounded-button"); }
  if (/ring-1 ring-control-border/.test(s) && /(hover:bg-accent|px-)/.test(s) && /\b(h-\d+|min-h-\d+)\b/.test(s)) { bump("outlined button"); return s.replace(R, "rounded-button"); }
  if (/hover:bg-accent/.test(s) && /\b(h-\d+|min-h-\d+)\b/.test(s) && /px-/.test(s) && !/\bgroup\b/.test(s)) { bump("ghost button"); return s.replace(R, "rounded-button"); }
  if (/rounded-(md|lg) bg-accent px-2 py-0\.5/.test(s)) { bump("chip"); return s.replace(/rounded-(md|lg)/, "rounded-chip"); }
  if (/rounded-(xl|2xl)/.test(s) && /(shadow-sm|border-dashed|ring-1 ring-border|bg-surface)/.test(s)) { bump("card"); return s.replace(/rounded-(xl|2xl)/, "rounded-card"); }
  if (/rounded-lg/.test(s) && /(bg-accent px-|border-error|border border)/.test(s)) { bump("note box"); return s.replace(/rounded-lg/, "rounded-field"); }
  return s;
}
let n = 0; for (const f of files) { const a = fs.readFileSync(f, "utf8"), b = a.replace(/(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g, (m, q, body) => { const x = /rounded-/.test(body) ? fix(body) : body; return x === body ? m : q + x + q; }); if (a !== b) { n++; if (process.argv.includes("--apply")) fs.writeFileSync(f, b); } }
console.log(JSON.stringify({ files: n, counts }));
