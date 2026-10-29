#!/usr/bin/env node
// READ-ONLY: every Act and regulator title in the database goes through displayTitle() (src/lib/docs/docType.mjs); counts the titles that would still look wrong to a reader. Target: zero in every class.
// usage: node scripts/audit/title-check.mjs
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { displayTitle } from "../../src/lib/docs/docType.mjs";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const main = neon(process.env.DATABASE_URL), reg = neon(process.env.REG_DATABASE_URL || process.env.DATABASE_URL);
const rows = [...(await main.query("SELECT title, category, NULL AS department, year, act_id AS \"actId\" FROM acts")), ...(await reg.query("SELECT title, 'regulatory' AS category, department, year, act_id AS \"actId\" FROM reg_acts"))];
export const WRONG = {
  "URL-encoded (%20)": /%[0-9A-F]{2}/i, "underscore": /_/, "file extension": /\.(pdf|docx?)\b/i, "letters glued to a 4-digit number": /[A-Za-z]{3,}\d{4}\b/, "digits glued to a word (01July)": /\b\d{1,2}[A-Za-z]{4,}\b/,
  "no capital letter": /^[^A-Z]*$/, "all capitals (6+ letters)": null, "double space": / {2,}/, "empty or numbers only": /^[\d\s./-]*$/,
};
const upperShare = (s) => { const l = s.match(/[A-Za-z]/g) ?? []; return l.length ? (s.match(/[A-Z]/g) ?? []).length / l.length : 0; };
const bad = {}; const sample = {};   // all capitals is wrong unless it is a notification number such as "S.O.1910(E)"
for (const r of rows) {
  const t = displayTitle(r.title, r);
  if (/[\u0900-\u097F]/.test(t)) continue;   // another script: left as written
  for (const [k, re] of Object.entries(WRONG)) { const hit = re ? re.test(t) && !(k === "no capital letter" && !/[A-Za-z]/.test(t)) : (upperShare(t) > 0.8 && (t.match(/[A-Za-z]/g) ?? []).length >= 6 && !/\d{2,}\(?[A-Z]?\)?/.test(t)); if (hit) { bad[k] = (bad[k] ?? 0) + 1; (sample[k] ??= []).length < 2 && sample[k].push(`${JSON.stringify(r.title.slice(0, 50))} -> ${JSON.stringify(t.slice(0, 50))}`); } }
}
const before = rows.filter((r) => /%[0-9A-F]{2}|_|[A-Za-z]{3,}\d{4}\b|^[^A-Z]*$/i.test(r.title) || (upperShare(r.title) > 0.8 && /[A-Za-z]{6}/.test(r.title))).length;
console.log(`${rows.length} titles; raw titles that look wrong: ${before}; after displayTitle:`);
for (const k of Object.keys(WRONG)) console.log(`  ${String(bad[k] ?? 0).padStart(5)} | ${k}${sample[k] ? "   e.g. " + sample[k][0] : ""}`);
process.exit(Object.values(bad).some((n) => n) ? 1 : 0);
