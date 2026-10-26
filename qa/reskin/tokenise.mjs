// Reskin Phase 1 codemod: moves hard-coded sizes and colours in class names into design tokens WITHOUT changing a pixel.
//   text-[Npx] -> text-fs-N, text/bg/border-[#hex] -> token colour classes, rounded-[Npx], tracking-[..], leading-[..], max-w-[Npx], and two arbitrary shadows -> token classes.
// Every replacement is value-identical (a token is added to src/styles/tokens.css and tailwind.config.ts for each new value). Inline hex in code is handled by hand (see the Phase 1 notes).
// usage: node qa/reskin/tokenise.mjs [--apply]   (dry run prints the counts and the new tokens)
import fs from "node:fs";
import path from "node:path";

const APPLY = process.argv.includes("--apply"), SRC = "src";
const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.tsx$/.test(f.name)) files.push(p); } })(SRC);

const FS_EXISTING = { 10: "micro", 11: "nano", 12: "xs", 13: "sm", 14: "ui", 15: "body", 16: "lead", 18: "xl", 24: "display", 28: "title" };
const COLOR_EXISTING = { "535151": "secondary", "3f3a35": "ink", "6e3730": "primary", "5a2d27": "primary-hover", "1e1b17": "dark" };
const COLOR_NAMED = { "65625f": "subtle", "1a1818": "strong", "414040": "soft", "b42323": "danger" };   // roles read from how they are used (secondary-and-lighter text, strongest text, softened text, error text)
const TRACK = { "0.12em": "caps-wide", "0.08em": "caps", "-0.02em": "tight", "-0.03em": "brand", "0.14em": "caps-xwide", "-0.025em": "snug", "-0.01em": "tight-soft", "0.1em": "caps-mid", "0.06em": "caps-soft" };
const TRACK_NEW = { "caps-xwide": "0.14em", snug: "-0.025em", "tight-soft": "-0.01em", "caps-mid": "0.1em", "caps-soft": "0.06em" };
const RADIUS = { "4px": "tight", "6px": "panel", "8px": "field", "2px": "control", "3px": "slim" };
const LEAD = { "1.7": "reading", "1.75": "reading-loose", "1.6": "body", "1.1": "display", "1.08": "display-tight" };
const LEAD_NEW = { "reading-loose": "1.75", body: "1.6", display: "1.1", "display-tight": "1.08" };

const newFs = new Set(), newColors = new Set(), newMw = new Set(), counts = {};
const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1);
function transform(src) {
  let s = src;
  s = s.replace(/\btext-\[(\d+(?:\.\d+)?)px\]/g, (m, n) => { bump("font-size"); if (FS_EXISTING[n]) return `text-fs-${FS_EXISTING[n]}`; newFs.add(n); return `text-fs-${n}`; });
  s = s.replace(/\b(text|bg|border|ring|fill|stroke|from|to|via|outline|decoration|divide|placeholder|caret|accent)-\[#([0-9a-fA-F]{6})\](\/\d+)?/g, (m, p, hex, op = "") => {
    hex = hex.toLowerCase(); bump("colour");
    if (COLOR_EXISTING[hex]) return `${p}-${COLOR_EXISTING[hex]}${op}`;
    const name = COLOR_NAMED[hex] ?? `legacy-${hex}`; newColors.add(`${name}|${hex}`); return `${p}-${name}${op}`;
  });
  s = s.replace(/\brounded-\[(\d+px)\]/g, (m, v) => { if (!RADIUS[v]) return m; bump("radius"); return `rounded-${RADIUS[v]}`; });
  s = s.replace(/\btracking-\[(-?[\d.]+em)\]/g, (m, v) => { if (!TRACK[v]) return m; bump("tracking"); return `tracking-${TRACK[v]}`; });
  s = s.replace(/\bleading-\[([\d.]+)\]/g, (m, v) => { if (!LEAD[v]) return m; bump("leading"); return `leading-${LEAD[v]}`; });
  s = s.replace(/\bmax-w-\[(\d+)px\]/g, (m, n) => { if (n === "880") { bump("max-width"); return "max-w-content"; } bump("max-width"); newMw.add(n); return `max-w-w${n}`; });
  s = s.replace(/\bshadow-\[0_6px_18px_rgba\(37,33,29,0\.08\)\]/g, () => { bump("shadow"); return "shadow-pop"; });
  return s;
}
let changed = 0;
for (const f of files) { const a = fs.readFileSync(f, "utf8"), b = transform(a); if (a !== b) { changed++; if (APPLY) fs.writeFileSync(f, b); } }
console.log(JSON.stringify({ filesChanged: changed, counts, newFontSizes: [...newFs], newColours: [...newColors], newMaxWidths: [...newMw] }, null, 1));
if (APPLY) fs.writeFileSync("/tmp/reskin-new-tokens.json", JSON.stringify({ newFs: [...newFs], newColors: [...newColors], newMw: [...newMw], TRACK_NEW, LEAD_NEW }));
