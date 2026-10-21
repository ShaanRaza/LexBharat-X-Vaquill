#!/usr/bin/env node
// Offline QA sweep over EVERY Supreme Court case record (src/data/judgments/sc/*.json), using the same code the app uses:
// src/lib/judgments/extract.mjs (bench and case-number parser) and src/lib/judgments/disposition.mjs (disposition labels).
// No browser, no network. Optional re-parse of the opening texts when the SSD is attached (or pass --openings <ndjson>).
// usage: node scripts/judgments/qa-sweep.mjs [--openings file.ndjson] [--dataset /Volumes/LAWSSD/open-india-law] [--out scripts/judgments/qa-report.md]
// Exit code 1 when any check has failures.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { displayDisposition } from "../../src/lib/judgments/disposition.mjs";
import { parseCaseNumber, printedBench, sameJudge } from "../../src/lib/judgments/extract.mjs";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DATASET = opt("--dataset", "/Volumes/LAWSSD/open-india-law"), OUT = opt("--out", "scripts/judgments/qa-report.md");
const dir = "src/data/judgments/sc", FIRST = 1950, LAST = 2026;
// Flags that were looked at and are correct (not bugs). They are listed in the report but do not fail the run.
const REVIEWED = { "1951_INSC_17": "Civil Appeal No. 95 of 1949: an appeal numbered before the Court's first year and decided in 1951; the heading really prints 1949" };

// ---- load every record
const records = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) for (const c of JSON.parse(readFileSync(path.join(dir, f), "utf8"))) records.push({ ...c, _file: Number(f.slice(0, 4)) });

// ---- opening texts (for the parser re-run): SSD via DuckDB, or a file, or none
let openings = null, openingsSource = "not available (SSD not attached): parser re-run skipped";
try {
  let file = opt("--openings", "");
  const parquet = path.join(DATASET, "in_supreme-court_judgments.parquet");
  if (!file && existsSync(parquet)) {
    file = path.join(mkdtempSync(path.join(tmpdir(), "qa-sweep-")), "opening.ndjson");
    execFileSync("duckdb", ["-c", `COPY (SELECT case_id AS "caseId", left(trim(regexp_replace(regexp_replace(regexp_replace(any_value(text), '^Case:[^\\n]*\\n+Section:[^\\n]*\\n*', ''), '\\[(SECTION|TITLE)\\]\\s*(#+)?\\s*', ' ', 'g'), '\\s+', ' ', 'g')), 3000) AS text FROM read_parquet('${parquet}') WHERE language_code = 'en' AND char_start = 0 GROUP BY case_id HAVING count(*) = 1) TO '${file}' (FORMAT JSON, ARRAY false)`], { stdio: "ignore" });
  }
  if (file && existsSync(file)) { openings = new Map(readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return [r.caseId, r.text]; })); openingsSource = `${openings.size.toLocaleString("en-IN")} English opening texts re-parsed`; }
} catch (e) { openingsSource = `skipped (${e.message.split("\n")[0]})`; }

// ---- checks
const CHECKS = [
  ["1. Bench consistency", "authoring judge on the extracted bench (initials-insensitive); no empty or repeated names; badges shown = names stored; parser re-run finds the same number of names"],
  ["2. Case number", "ends in \"of <4-digit year>\" for every item; years 1950-2026 and not after the report year; re-run of the parser gives the same string"],
  ["3. Disposition", "every non-empty recorded value maps to a normalized label (idempotent, capitalised); the raw value is still stored on the record"],
  ["4. No crashes", "parsing, labelling and date handling never throw for any record or opening text"],
  ["5. Dates", "decision date present, a real calendar date, within 1950-2026, and filed under the matching year"],
];
const stat = CHECKS.map(([name]) => ({ name, checked: 0, fail: 0, reviewed: 0 })), fails = new Map();   // caseId -> [{check, reason}]
const note = (c, i, reason) => { if (REVIEWED[c.caseId]) { stat[i].reviewed++; return; } stat[i].fail++; (fails.get(c.caseId) ?? fails.set(c.caseId, []).get(c.caseId)).push({ check: CHECKS[i][0], reason }); };
const crashes = []; const labels = new Map();

for (const c of records) {
  // 4 + everything below runs inside try/catch: a thrown error is a finding, never a stop
  try {
    stat[3].checked++;
    // 1 bench
    if (c.benchExtracted) {
      stat[0].checked++;
      const b = c.benchExtracted, why = [];
      if (!Array.isArray(b) || !b.length) why.push("empty bench array");
      else {
        if (b.some((n) => typeof n !== "string" || !n.trim())) why.push("empty name");
        if (new Set(b.map((n) => n.toUpperCase())).size !== b.length) why.push("repeated name");
        if (c.judges?.length && !c.judges.some((a) => b.some((n) => sameJudge(a, n)))) why.push(`authoring judge ${JSON.stringify(c.judges)} not on bench`);
        const text = openings?.get(c.caseId);
        if (text) { const p = printedBench(text, c.caseId); if (!p) why.push("parser re-run finds no bench block"); else if (p.names.length !== b.length) why.push(`badges ${b.length} but heading prints ${p.names.length} names`); }
      }
      if (why.length) note(c, 0, why.join("; "));
    }
    // 2 case number
    if (c.caseNumberExtracted) {
      stat[1].checked++;
      const n = c.caseNumberExtracted, why = [];
      const items = n.split(" and ");
      for (const it of items) {
        const m = /\bof (\d{4})$/.exec(it);
        if (!m) { why.push(`item "${it}" does not end in "of <year>"`); continue; }
        const y = Number(m[1]); if (y < FIRST || y > LAST) why.push(`implausible year ${y}`); else if (y > Number(c.caseId.slice(0, 4)) + 1) why.push(`filed (${y}) after the report year`);
        if (!/\bNos?\.\s*\S/.test(it) && !/\bNo\(s\)/.test(it)) why.push(`no number in "${it}"`);
      }
      const text = openings?.get(c.caseId);
      if (text) { const again = parseCaseNumber(text, Number(c.caseId.slice(0, 4)) + 1, c.caseId); if (again !== n) why.push(`parser re-run gives ${JSON.stringify(again)}`); }
      if (why.length) note(c, 1, why.join("; "));
    }
    // 3 disposition
    if (c.disposition && c.disposition.trim()) {
      stat[2].checked++;
      const label = displayDisposition(c.disposition), why = [];
      if (!label) why.push("no label");
      else {
        if (label[0] !== label[0].toUpperCase()) why.push(`label "${label}" not capitalised`);
        if (displayDisposition(label) !== label) why.push(`label "${label}" is not stable`);
        if (/&|\bdisposed off\b/i.test(label)) why.push(`label "${label}" keeps a raw spelling`);
        const e = labels.get(label) ?? labels.set(label, new Map()).get(label); e.set(c.disposition, (e.get(c.disposition) ?? 0) + 1);
      }
      if (typeof c.disposition !== "string") why.push("raw value not retrievable");
      if (why.length) note(c, 2, why.join("; "));
    }
    // 5 dates
    stat[4].checked++;
    const d = c.decisionDate, why5 = [];
    if (!d) why5.push("missing decision date");
    else if (!/^\d{4}-\d{2}-\d{2}/.test(d)) why5.push(`not an ISO date: ${d}`);
    else {
      const [y, m, day] = d.slice(0, 10).split("-").map(Number), t = new Date(Date.UTC(y, m - 1, day));
      if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== day) why5.push(`not a real date: ${d}`);
      if (y < FIRST || y > LAST) why5.push(`outside ${FIRST}-${LAST}: ${d}`);
      if (c._file !== y) why5.push(`filed under ${c._file} but decided in ${y}`);
    }
    if (why5.length) note(c, 4, why5.join("; "));
  } catch (e) { crashes.push({ caseId: c.caseId, error: String(e).slice(0, 160) }); note(c, 3, `threw: ${String(e).slice(0, 120)}`); }
}
// opening texts are also parsed on their own (including cases whose stored fields are empty), so the parser itself is exercised on all of them
let parsed = 0;
if (openings) for (const [id, text] of openings) {
  stat[3].checked++;
  try { printedBench(text, id); parseCaseNumber(text, Number(id.slice(0, 4)) + 1, id); parsed++; }
  catch (e) { crashes.push({ caseId: id, error: String(e).slice(0, 160) }); (fails.get(id) ?? fails.set(id, []).get(id)).push({ check: CHECKS[3][0], reason: `parser threw: ${String(e).slice(0, 100)}` }); stat[3].fail++; }
}

// ---- report
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(2) + "%" : "n/a");
const rows = stat.map((s, i) => `| ${s.name} | ${s.checked.toLocaleString("en-IN")} | ${(s.checked - s.fail - s.reviewed).toLocaleString("en-IN")} | ${s.fail.toLocaleString("en-IN")}${s.reviewed ? ` (+${s.reviewed} reviewed, correct)` : ""} | ${pct(s.fail, s.checked)} | ${CHECKS[i][1]} |`);
const worst = [...fails].map(([id, f]) => ({ id, n: f.length, f })).sort((a, b) => b.n - a.n || a.id.localeCompare(b.id)).slice(0, 50);
const withBench = records.filter((c) => c.benchExtracted).length, withNo = records.filter((c) => c.caseNumberExtracted).length;
const labelRows = [...labels].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))
  .map(([l, m]) => `| ${l} | ${[...m.values()].reduce((x, y) => x + y, 0).toLocaleString("en-IN")} | ${[...m].map(([r, n]) => `${r} (${n})`).join("; ")} |`);
const md = `# Supreme Court case pages: offline QA sweep

Generated by \`node scripts/judgments/qa-sweep.mjs\` on ${new Date().toISOString().slice(0, 10)}. Parser and label code: \`src/lib/judgments/extract.mjs\`, \`src/lib/judgments/disposition.mjs\` (the same files the app imports).
Records swept: **${records.length.toLocaleString("en-IN")}** (every Supreme Court case in the bundled data). Cases with an extracted bench: ${withBench.toLocaleString("en-IN")}; with an extracted case number: ${withNo.toLocaleString("en-IN")}.
Opening texts: ${openingsSource}${openings ? `; parsed without a throw: ${parsed.toLocaleString("en-IN")}` : ""}.

## Summary

| Check | Checked | Pass | Fail | Failure rate | What is checked |
|---|---|---|---|---|---|
${rows.join("\n")}

${crashes.length ? `**Crashes:** ${crashes.length}\n${crashes.slice(0, 10).map((c) => `- ${c.caseId}: ${c.error}`).join("\n")}\n` : "**Crashes:** none; every record and opening text parsed without an exception.\n"}
## Worst offending records (up to 50)

${Object.keys(REVIEWED).length ? `Reviewed and correct (flagged by a check, not bugs): ${Object.entries(REVIEWED).map(([k, v]) => `**${k}** (${v})`).join("; ")}.\n\n` : ""}${worst.length ? "| Record | Failed checks | Reasons |\n|---|---|---|\n" + worst.map((w) => `| ${w.id} | ${w.n} | ${w.f.map((x) => `${x.check}: ${x.reason}`).join(" / ").slice(0, 220)} |`).join("\n") : "None: every check passed for every record."}

## Disposition vocabulary (raw values kept on the record, shown as "as recorded")

| Label shown | Cases | Recorded values underneath |
|---|---|---|
${labelRows.join("\n")}
`;
writeFileSync(OUT, md);
writeFileSync(path.join(tmpdir(), "qa-sweep-failures.json"), JSON.stringify(worst.map((w) => w.id)));
console.log(md);
process.exit(stat.some((s) => s.fail) ? 1 : 0);
