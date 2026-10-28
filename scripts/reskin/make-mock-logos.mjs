// Builds docs/mockups/brand/sprite.svg (the pilcrow mark and the "Lex" + "Bharat" lockup, one colour = currentColor) from the design repo's geometry, so the mock-ups use logo direction 1a.
// Usage: node scripts/reskin/make-mock-logos.mjs [path to lex-bharat-design/lib/brand.ts]
import fs from "node:fs";
const src = fs.readFileSync(process.argv[2] ?? "../lex-bharat-design/lib/brand.ts", "utf8"), get = (name) => new RegExp(`\\b${name}:\\s*"([^"]+)"`).exec(src)?.[1];
const lockupW = Number(/LOCKUP\s*=\s*\{\s*w:\s*([\d.]+)/.exec(src)?.[1]);
const pilcrow = get("pilcrow"), bar = get("bar"), lex = get("lex"), bharat = get("bharat");
if (!lockupW || !pilcrow || !bar || !lex || !bharat) throw new Error("brand geometry not found");
const mark = `<path d="${pilcrow}"/><path d="${bar}"/>`;
fs.mkdirSync("docs/mockups/brand", { recursive: true });
fs.writeFileSync("docs/mockups/brand/sprite.svg", `<svg xmlns="http://www.w3.org/2000/svg">
<symbol id="mark" viewBox="0 0 64.69 78.75" fill="currentColor">${mark}</symbol>
<symbol id="lockup" viewBox="0 0 ${lockupW} 78.75" fill="currentColor">${mark}<path d="${lex}"/><path d="${bharat}"/></symbol>
</svg>
`);
console.log("wrote docs/mockups/brand/sprite.svg");
