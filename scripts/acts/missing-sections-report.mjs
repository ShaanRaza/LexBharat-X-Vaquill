#!/usr/bin/env node
// Writes docs/MISSING-SECTIONS.md for the 100 most-used Central Acts (list from rank-central-acts.mjs). Reports only; nothing is fixed.
// usage: node scripts/acts/missing-sections-report.mjs <top100.json> [out.md]
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { findGaps, maxCitedSection, robustMax, startsWithOwnNumber } from "../../src/lib/acts/gaps.mjs";
import { knownMaxFor } from "../../src/lib/acts/knownCounts.mjs";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";

const top = JSON.parse(fs.readFileSync(process.argv[2], "utf8")), OUT = process.argv[3] ?? "docs/MISSING-SECTIONS.md";
const DIR = path.resolve("../lexbharat-data/acts-text"), PARQ = "/Volumes/LAWSSD/open-india-law";
const ids = top.map((a) => `'${a.actId}'`).join(",");
// numbers whose pieces carry 3 or more different section headings = several provisions share one number (Order/Schedule text under a section number, as with CPC s.11)
const collRows = JSON.parse(execFileSync("duckdb", ["-json", "-c", `SELECT act_id, section_number, count(DISTINCT lower(regexp_replace(regexp_extract(split_part(text, chr(10), 2), 'Section [^:]+: (.*)$', 1), '[^a-zA-Z0-9]+', '', 'g'))) AS titles FROM read_parquet('${PARQ}/in_*_legislation.parquet') WHERE act_id IN (${ids}) AND coalesce(section_number,'') <> '' GROUP BY 1, 2 HAVING titles >= 3`], { maxBuffer: 1 << 28 }).toString() || "[]");
const coll = new Map(); for (const r of collRows) (coll.get(r.act_id) ?? coll.set(r.act_id, []).get(r.act_id)).push(r.section_number);

const rows = [];
for (const a of top) {
  const d = JSON.parse(gunzipSync(fs.readFileSync(path.join(DIR, `act=${a.actId}.json.gz`))));
  const recs = d.sections.map((s, i) => ({ ...toSectionRecord(s, i), kind: s.kind }));
  const numbered = recs.filter((r) => r.kind === "s" && r.number);
  const nums = numbered.map((r) => r.number), heldMax = robustMax(nums.map((n) => parseInt(n, 10) || 0).filter(Boolean));
  const g = findGaps(nums, maxCitedSection(recs.map((r) => r.body ?? ""), heldMax), knownMaxFor(a.title));
  const wrongStart = numbered.filter((r) => r.body && startsWithOwnNumber(r.number, r.body) === false).map((r) => r.number);
  rows.push({ actId: a.actId, title: a.title.replace(/,? ?\d* ?of \d{4}.*$/, "").replace(/\s*\(Rep\..*$/, "").slice(0, 52), status: d.actStatus, sc: a.scJudgments, held: numbered.length, ...g, wrongStart, collisions: coll.get(a.actId) ?? [] });
}
const sum = (f) => rows.reduce((n, r) => n + f(r), 0);
const worst = [...rows].sort((a, b) => (b.missing.length + b.collisions.length) - (a.missing.length + a.collisions.length)).slice(0, 20);
const list = (arr, n = 30) => arr.length ? arr.slice(0, n).join(", ") + (arr.length > n ? ` … (+${arr.length - n})` : "") : "none";
const ADD = `
## What the data itself shows
- Whole Acts are almost empty: Customs Act 1962 holds 3 of its sections, Arms Act 1959 holds none that carry a number, Limitation Act 1963 holds 21 of 32.
- Some Acts are filed under the wrong category: the Code of Criminal Procedure, 1973 has **no Central entry**; more than a dozen copies of it (443 sections each) are filed under individual States. Section search therefore finds "CrPC" sections under State Acts.
- Section numbers are reused by other text: the Code of Civil Procedure, 1908 holds Order and rule text under numbers 11 and 20; the NI Act's numbers run past 148 because amending text is filed under it.

## Can gaps be filled from India Code later? (terms check, no India Code text fetched)
**Finding: not confirmed. Do not copy from India Code until written permission or an explicit licence is found.**
- India Code's disclaimer page (https://www.indiacode.nic.in/disclaimer.jsp?locale=en) is reachable in a browser but returned **HTTP 403 Forbidden** to this tool, and so did the home page: the site refuses automated requests. Its text could therefore not be read here. A search describes it as an accuracy disclaimer only (content provided "as is"; the English version of an Act controls if versions differ), not a licence for reuse.
- I found **no page on indiacode.nic.in that grants or forbids reuse or bulk copying**. Government of India sites often carry a separate website-policies page (https://igod.gov.in/website_policies, which failed here with a certificate error) and some publish under the Government Open Data License - India (GODL-India), which allows use, adaptation and publication with attribution; but nothing I could reach says India Code content is under GODL-India.
- The open-india-law dataset we use says it was compiled from India Code under CC BY 4.0, which is the compiler's claim about its own compilation, not India Code's licence.
- **Safe now:** link to India Code (done: "Read it on India Code"). **Before filling gaps:** ask the Legislative Department / India Code team in writing (permission for programmatic access and republishing), or take the text from another source whose terms are clear. Check with a lawyer; I am not giving legal advice.
`;
const md = `# Missing and wrong sections: the 100 most-used Central Acts

Generated by \`scripts/acts/missing-sections-report.mjs\`. **Reports only; nothing was fixed or fetched from India Code.**

## How the 100 Acts were chosen
Rank = number of Supreme Court judgments (distinct case ids in open-india-law v2026.08) whose text names the Act, summed over the name variants judgments use ("Indian Penal Code, 1860" and "Penal Code, 1860"), matched to our Central Acts by title and year (\`scripts/acts/sc-act-mentions.sql\`, \`rank-central-acts.mjs\`). Repealed Acts are included because the Court still cites them (IPC, Evidence Act, Companies Act 1956). The dataset has no headnote or "acts cited" field for judgments, so the full judgment text is the measure. Limits: abbreviations ("IPC", "NI Act") are not counted, so heavily abbreviated Acts rank lower than their real use.

## How "missing" and "wrong text" are decided
- **Missing:** an Act numbers its sections 1, 2, 3 ... without skipping (omitted sections stay as "[Omitted]" entries), so an integer absent from 1..N is very likely absent from our data. N = the highest section number we hold, or the highest "section N" the Act's own text cites, whichever is larger (a lower bound; the true count may be higher).
- **Reference counts:** for 17 very well-known Acts (NI Act 148, IPC 511, Evidence Act 167, CrPC 484, CPC 158, Contract Act 238 and so on, \`src/lib/acts/knownCounts.mjs\`) N is that count instead, because extra numbered text filed under an Act (amending Acts, schedules) otherwise pushes N too high. These counts come from general knowledge and have **not** been checked against India Code.
- **Confident missing** (drives the message on the Act page): the Act holds at least 85% of 1..N and the gap is 5 numbers or fewer in a row. Everything else is "uncertain" (no message is shown).
- **Wrong text (suspects):** (a) the section's text starts with a different number than its own, or (b) the pieces stored under one number carry 3 or more different headings (several provisions share a number, as with CPC s.11 which holds Order text). These are indicators to check, not proof.

## Summary
| | |
|---|---:|
| Acts analysed | ${rows.length} (${rows.filter((r) => r.status === "in_force").length} in force, ${rows.filter((r) => r.status !== "in_force").length} repealed or spent) |
| Section numbers we hold | ${sum((r) => r.held).toLocaleString("en-IN")} |
| Section numbers expected (lower bound) | ${sum((r) => r.expectedMax).toLocaleString("en-IN")} |
| **Missing numbers** | **${sum((r) => r.missing.length).toLocaleString("en-IN")}** (${sum((r) => r.confident.length).toLocaleString("en-IN")} confident, ${sum((r) => r.uncertain.length).toLocaleString("en-IN")} uncertain) |
| Acts missing at least one number | ${rows.filter((r) => r.missing.length).length} |
| Acts holding fewer than half of their expected sections | ${rows.filter((r) => r.severe).length} |
| Sections whose text starts with another number | ${sum((r) => r.wrongStart.length).toLocaleString("en-IN")} in ${rows.filter((r) => r.wrongStart.length).length} Acts |
| Section numbers shared by 3+ different provisions | ${sum((r) => r.collisions.length).toLocaleString("en-IN")} in ${rows.filter((r) => r.collisions.length).length} Acts |

## The worst 20 Acts (missing numbers plus shared numbers)
| # | Act | Status | SC cases | Held / expected | Missing | Confident | Shared numbers | Starts with other number |
|---:|---|---|---:|---:|---:|---:|---:|---:|
${worst.map((r, i) => `| ${i + 1} | ${r.title} | ${r.status.replace("_", " ")} | ${r.sc} | ${r.held} / ${r.expectedMax} | ${r.missing.length} | ${r.confident.length} | ${r.collisions.length} | ${r.wrongStart.length} |`).join("\n")}

${ADD}

## All 100 Acts
| Act | Status | SC cases | Held / expected | Missing numbers (first 30) | Shared numbers (first 12) |
|---|---|---:|---:|---|---|
${rows.map((r) => `| ${r.title} | ${r.status.replace("_", " ")} | ${r.sc} | ${r.held} / ${r.expectedMax} | ${r.severe ? "**most sections absent**; " : ""}${list(r.missing)} | ${list(r.collisions, 12)} |`).join("\n")}
`;
fs.writeFileSync(OUT, md);
console.log(JSON.stringify({ acts: rows.length, held: sum((r) => r.held), expected: sum((r) => r.expectedMax), missing: sum((r) => r.missing.length), confident: sum((r) => r.confident.length), severeActs: rows.filter((r) => r.severe).length, actsWithMissing: rows.filter((r) => r.missing.length).length, wrongStart: sum((r) => r.wrongStart.length), sharedNumbers: sum((r) => r.collisions.length) }));
