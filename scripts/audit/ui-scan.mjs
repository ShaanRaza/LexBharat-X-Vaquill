#!/usr/bin/env node
// Lists every place that looks clickable but is not, or is clickable but does not look it (rules in ui-rules.mjs). usage: node scripts/audit/ui-scan.mjs
import { scanAll } from "./ui-rules.mjs";
const v = scanAll(), by = {}; for (const x of v) (by[x.rule] ??= []).push(x);
for (const [r, list] of Object.entries(by).sort()) { console.log(`\n${r}: ${list.length}`); for (const x of list) console.log(`  ${x.file}:${x.line}  ${x.msg}`); }
console.log(`\ntotal ${v.length}`);
