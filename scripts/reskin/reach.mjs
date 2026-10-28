// Which files under src/ are still used after the restructure? Roots = the pages and routes that stay; everything they import (directly or not) is kept; the rest is removable.
// Usage: node scripts/reskin/reach.mjs [--list]   (prints counts per folder, or every file with --list)
import fs from "node:fs"; import path from "node:path";
const SRC = path.resolve("src"), all = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : all.push(p); } })(SRC);
const rel = (p) => path.relative(SRC, p), set = new Set(all);
const KEEP_APP = [/^app\/layout\.tsx$/, /^app\/globals\.css$/, /^app\/fonts\//, /^app\/favicon/, /^app\/access\//, /^app\/admin\//, /^app\/api\/(?!mock\/|playground\/)/, /^app\/\(console\)\/workspace\//, /^app\/\(site\)\/\[legal\]\//, /^app\/\(site\)\/security\//, /^middleware\.ts$/, /^app\/not-found/];
const roots = all.filter((f) => KEEP_APP.some((r) => r.test(rel(f))));
const EXT = ["", ".ts", ".tsx", ".mjs", ".js", ".json", ".css", "/index.ts", "/index.tsx"];
const resolve = (from, spec) => { const base = spec.startsWith("@/") ? path.join(SRC, spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(from), spec) : null; if (!base) return null; for (const e of EXT) if (set.has(base + e)) return base + e; return null; };
const seen = new Set(), q = [...roots];
while (q.length) { const f = q.pop(); if (seen.has(f)) continue; seen.add(f); if (!/\.(tsx?|mjs|js|css)$/.test(f)) continue; const t = fs.readFileSync(f, "utf8");
  for (const m of t.matchAll(/(?:from|import\(|require\(|@import\s+(?:url\()?)\s*["']([^"']+)["']/g)) { const r = resolve(f, m[1]); if (r) q.push(r); if (r?.endsWith(".mjs")) { const d = r.replace(/\.mjs$/, ".d.mts"); if (set.has(d)) q.push(d); } } }
for (const f of all) if (/\.d\.mts$/.test(f) && seen.has(f.replace(/\.d\.mts$/, ".mjs"))) seen.add(f);
for (const f of all) if (/\.test\.mjs$/.test(f)) { const s = f.replace(/\.test\.mjs$/, ".mjs"), s2 = f.replace(/\.test\.mjs$/, ".ts"); if (seen.has(s) || seen.has(s2)) seen.add(f); }
const dead = all.filter((f) => !seen.has(f)).map(rel).sort();
if (process.argv.includes("--list")) console.log(dead.join("\n"));
else { const g = {}; for (const f of dead) { const k = f.split("/").slice(0, f.startsWith("app/") ? 3 : 2).join("/"); g[k] = (g[k] ?? 0) + 1; } console.log(`kept ${seen.size} of ${all.length}; removable ${dead.length}`); for (const [k, v] of Object.entries(g).sort()) console.log(String(v).padStart(4), k); }
