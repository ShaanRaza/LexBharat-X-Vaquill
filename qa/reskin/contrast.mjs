// Contrast of the token pairs the UI actually uses (WCAG 2.x). Reads src/styles/tokens.css. Text needs 4.5:1 (large 3:1); UI component outlines need 3:1 (we require 4.5 for control-border).
// usage: node qa/reskin/contrast.mjs   (exit 1 if any required pair fails)
import fs from "node:fs";
const css = fs.readFileSync("src/styles/tokens.css", "utf8"), vars = {};
for (const m of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) if (!(m[1] in vars)) vars[m[1]] = m[2].trim();
const ALIAS = { secondary: "text-secondary", ink: "text-ink" };
const rgb = (n0) => { const n = ALIAS[n0] ?? n0; const v = vars[`${n}-rgb`]; if (v) return v.split(/\s+/).map(Number); const h = vars[n]; if (/^#[0-9a-f]{6}/i.test(h)) return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); throw new Error("no token " + n); };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (fg, bg, a) => fg.map((c, i) => Math.round(c * a + bg[i] * (1 - a)));   // fg at alpha a over bg
const BG = ["surface", "background", "raised", "accent"];
const rows = [], bad = [];
const check = (label, fg, bgc, need) => { const r = cr(fg, bgc); rows.push([label, r.toFixed(2), need, r >= need ? "ok" : "FAIL"]); if (r < need) bad.push(label); };
for (const t of ["foreground", "secondary", "ink", "muted", "subtle", "strong", "soft", "primary", "success", "warning", "error", "danger"]) for (const b of BG) check(`text ${t} on ${b}`, rgb(t), rgb(b), 4.5);
for (const b of BG) check(`on-primary text on primary (button) [${b}]`, [255, 255, 255], rgb("primary"), 4.5);
check("white on primary-hover", [255, 255, 255], rgb("primary-hover"), 4.5);
for (const t of ["success", "warning", "error"]) { const bg = mix(rgb(t), rgb("surface"), 0.1); check(`badge ${t} text on its 10% tint over surface`, rgb(t), bg, 4.5); const bg2 = mix(rgb(t), rgb("background"), 0.1); check(`badge ${t} text on its 10% tint over background`, rgb(t), bg2, 4.5); }
for (const b of ["surface", "background"]) check(`control-border on ${b} (outline of inputs and buttons)`, rgb("control-border"), rgb(b), 4.5);
for (const b of ["surface", "background"]) check(`primary focus ring on ${b}`, rgb("primary"), rgb(b), 3);
rows.push(["border (decorative hairline) on surface", cr(rgb("border"), rgb("surface")).toFixed(2), "n/a", "decorative only; controls use control-border"]);
for (const r of rows) console.log(r.join(" | "));
console.log(bad.length ? `\n${bad.length} FAIL: ${bad.join("; ")}` : "\nPASS: every required pair meets WCAG AA");
process.exit(bad.length ? 1 : 0);
