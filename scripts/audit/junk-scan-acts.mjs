#!/usr/bin/env node
// READ-ONLY scan of the text of Acts (act_sections_v) and regulator instruments (reg_sections) for extraction junk that must not reach a reader: counts how many sections show each pattern and prints two samples of each.
// usage: node scripts/audit/junk-scan-acts.mjs [out.json]
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
export const PATTERNS = {
  "picture omitted marker (==> picture ... <==)": String.raw`==>|<==`,
  "amendment number before a bracket (4[words])": String.raw`(^|[^0-9A-Za-z])[0-9]{1,2}\s?\[`,
  "number in brackets before a bracket ([1] [( 1 )])": String.raw`\[[0-9]{1,2}\]\s*\[`,
  "markdown bold (**)": String.raw`\*\*`,
  "markdown italics (_word_)": String.raw`(^|\s)_[A-Za-z][^_\n]{0,60}_(\s|[.,;:]|$)`,
  "markdown heading (##)": String.raw`(^|\n)#{1,6}\s`,
  "markdown quote (> at line start)": String.raw`(^|\n)>\s`,
  "spaced brackets ( a )": String.raw`\(\s+[A-Za-z0-9]{1,4}\s+\)`,
  "space before punctuation ( .)": String.raw`[a-z] [.,;:](\s|$)`,
  "joined words (the+word, 9+ letters)": String.raw`(^|\s)(the|of|and|to|in)[a-z]{9,}(\s|[.,;:])`,
  "replacement character": String.raw`�`,
  "HTML tag or entity": String.raw`<\/?[a-z]{1,6}>|&(amp|nbsp|lt|gt|quot);`,
  "page header or number line": String.raw`(^|\n)\s*(Page\s+\d+|\d+\s*\|\s*Page)\s*($|\n)`,
  "three or more blank-ish repeats (. . . . or ----)": String.raw`(\. ){4,}|-{5,}|_{5,}`,
  "tab or double space": String.raw`\t|  `,
  "backslash escape (\\n, \\u)": String.raw`\\[nrtu]`,
};
const OUT = process.argv[2];
const run = async (label, sql, table, col) => {
  const res = {};
  for (const [name, re] of Object.entries(PATTERNS)) {
    try {
      const n = (await sql.query(`SELECT count(*)::int n FROM ${table} WHERE ${col} ~ $1`, [re]))[0].n;
      const sample = n ? await sql.query(`SELECT substring(${col} from position(substring(${col} from $1) in ${col}) - 30 for 110) AS s FROM ${table} WHERE ${col} ~ $1 LIMIT 2`, [re]).catch(() => []) : [];
      res[name] = { sections: n, samples: sample.map((x) => String(x.s ?? "").replace(/\s+/g, " ").slice(0, 120)) };
      console.log(`${label} | ${String(n).padStart(7)} | ${name}${sample.length ? "  e.g. " + JSON.stringify(sample[0].s?.replace(/\s+/g, " ").slice(0, 80)) : ""}`);
    } catch (e) { res[name] = { error: String(e.message).slice(0, 80) }; console.log(`${label} | ERR | ${name} ${String(e.message).slice(0, 60)}`); }
  }
  return res;
};
const main = neon(process.env.DATABASE_URL), reg = neon(process.env.REG_DATABASE_URL || process.env.DATABASE_URL);
const total = (await main.query("SELECT count(*)::int n FROM act_sections_v WHERE body IS NOT NULL"))[0].n, regTotal = (await reg.query("SELECT count(*)::int n FROM reg_sections WHERE body IS NOT NULL").catch(() => [{ n: 0 }]))[0].n;
console.log(`Acts: ${total} sections with text; regulators: ${regTotal}\n`);
const acts = await run("acts", main, "act_sections_v", "body");
const regs = regTotal ? await run("regs", reg, "reg_sections", "body") : {};
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), total, regTotal, acts, regs }, null, 1));
