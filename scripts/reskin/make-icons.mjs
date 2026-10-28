// Writes src/app/icon.svg (the browser-tab icon): the pilcrow mark in the paper colour on a forest tile. Colours are READ from src/styles/tokens.css (--primary, --background) and the mark from
// src/lib/brand.ts, so changing the tokens and re-running this keeps the icon in step. An SVG scales to the 32 and 16 px sizes a tab uses. Usage: node scripts/reskin/make-icons.mjs
import fs from "node:fs";
const tokens = fs.readFileSync("src/styles/tokens.css", "utf8"), tok = (n) => new RegExp(`--${n}:\\s*(#[0-9a-fA-F]{3,8})`).exec(tokens)?.[1];
const brand = fs.readFileSync("src/lib/brand.ts", "utf8"), mw = Number(/MARK = \{ w: ([\d.]+), h: ([\d.]+)/.exec(brand)?.[1]), mh = Number(/MARK = \{ w: [\d.]+, h: ([\d.]+)/.exec(brand)?.[1]);
const paths = [...brand.matchAll(/paths: \[("[^"]+"), ("[^"]+")\]/g)][0]?.slice(1, 3).map((x) => JSON.parse(x));
const bg = tok("primary"), fg = tok("background"); if (!bg || !fg || !mw || !mh || !paths) throw new Error("tokens or brand geometry not found");
const size = 32, h = 19, s = h / mh, w = mw * s, tx = (size - w) / 2, ty = (size - h) / 2;
fs.writeFileSync("src/app/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="7" fill="${bg}"/><g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})" fill="${fg}">${paths.map((d) => `<path d="${d}"/>`).join("")}</g></svg>\n`);
console.log("wrote src/app/icon.svg", bg, fg);
