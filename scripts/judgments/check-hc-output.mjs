#!/usr/bin/env node
// The High Court output guard. Fails (exit 1) if any person field or name pattern reaches the High Court export. Run by export-judgments-hc.sh after every export.
// usage: node scripts/judgments/check-hc-output.mjs [DATA_DIR=../lexbharat-data/judgments-hc-v2] [--courts a,b]
//
// WHAT IT PROMISES, and nothing more:
//   1. No person field: every case row carries only HC_FIELDS (src/lib/judgments/hcRecord.mjs). petitioner, respondent, judges, bench size, advocates and
//      addresses are not allowed, and neither is a bench filter (bench=... folders, a "bench" facet).
//   2. No names in the header: the title must be in its registration form ("WP/933/2024"), and no text field may hold a name pattern
//      (" Vs ", " v. ", "versus", S/o W/o D/o R/o C/o, "Age 45", "Occ.", "advocate", "Adv.", a 6-digit PIN code).
// WHAT IT DOES NOT CHECK: the judgment body. The High Court export holds no judgment text, but wherever judgment text is used (the opening text of a
// Supreme Court case, Qdrant payloads and embeddings in LexBharat-from-scratch) it is kept as recorded and DOES contain names of parties and judges,
// and sometimes addresses. Pattern rules cannot find every name in free text, so this guard does not try.
// Same rules as core/pii_guard.py in LexBharat-from-scratch (issue #213); pii-guard-fixture.json is the shared test fixture that keeps the two in step.
// A hit is reported by file, field and kind only, never with the value, so the guard's own output cannot leak a name.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { HC_FIELDS, isRegForm } from "../../src/lib/judgments/hcRecord.mjs";

export const PATTERNS = [
  ["versus", /\s(?:vs\.?|v\.|versus)\s/i],
  ["relation (S/o, W/o, D/o, R/o, C/o)", /\b[SWDRC]\s?\/\s?o\b/i],
  ["age", /\baged?\s*[:.-]?\s*\d{1,3}\b/i],
  ["occupation", /\bocc(?:\.|upation\b)/i],
  ["advocate", /\badvocates?\b|\badv\./i],
  ["PIN code", /(?<![\d/])[1-8]\d{5}(?![\d/])/],
];
const CASE_NO = /(?<!\d)\d{1,7}\s*(?:\/|of)\s*\d{4}(?!\d)/gi;   // "100436 of 2024" is a case number, not a PIN code
/** Name-pattern kinds found in one text value. */
// A value made only of digits ("123456", a case number recorded without its year) is a number, not an address.
export const textHits = (s) => { if (/^\s*\d+\s*$/.test(String(s))) return []; const t = String(s).replace(CASE_NO, " "); return PATTERNS.filter(([, re]) => re.test(t)).map(([n]) => n); };

/** Why one case row is not clean (empty when it is). */
export function rowHits(row) {
  const out = [];
  for (const [k, v] of Object.entries(row)) {
    if (!HC_FIELDS.includes(k)) { out.push(`field "${k}" is not allowed`); continue; }
    if (k === "title" && v !== null && !isRegForm(v)) out.push(`title is not in registration form`);
    if (typeof v === "string" && k !== "caseId") for (const h of textHits(v)) out.push(`${k}: ${h}`);
  }
  return out;
}

const KEYS = { _manifest: ["year", "cases", "pages"], _quarantine: ["caseId", "reason", "decision_date_raw", "year_raw"],
  _fields: ["cases", "title", "case_number", "case_number_recorded", "decision_date", "disposition", "disposition_chip", "pages", "citation"],
  _removed: ["cases", "parties_removed", "judges_removed", "title_tail_cut", "title_dropped", "case_number_differs", "wrong_court_quarantined"] };
const META = ["version", "built", "shards", "docs", "postings", "words", "courts", "segments", "scope"];
const json = (f) => JSON.parse(readFileSync(f, "utf8"));
const objHits = (o, allowed) => Object.entries(o).flatMap(([k, v]) => (!allowed.includes(k) ? [`field "${k}" is not allowed`] : typeof v === "string" ? textHits(v).map((h) => `${k}: ${h}`) : []));

/** Checks an export folder. Returns per-court counts and every hit as { file, why }. */
export function checkDir(dir, courts = null) {
  const hits = [], per = {}, hit = (file, why) => hits.push({ file: path.relative(dir, file), why });
  const want = (slug) => !courts || courts.includes(slug);
  for (const top of readdirSync(dir)) {
    const p = path.join(dir, top);
    if (top.startsWith("court=")) {
      const slug = top.slice(6); if (!want(slug) || slug === "supreme-court-of-india") continue;   // Supreme Court opening text (preview.json) is not High Court data and is not checked here
      const c = (per[slug] ??= { files: 0, rows: 0, hits: 0 }), before = hits.length;
      for (const y of readdirSync(p)) {
        const yp = path.join(p, y); if (!/^year=\d{4}$/.test(y)) { hit(yp, "unexpected entry"); continue; }
        const walk = (d, depth) => { for (const e of readdirSync(d)) {
          const ep = path.join(d, e);
          if (e === "data_0.json") { c.files++; for (const [i, row] of json(ep).entries()) { c.rows++; for (const w of rowHits(row)) hit(ep, `row ${i}: ${w}`); } }
          else if (e === "facets.json" && depth === 0) { c.files++; for (const w of objHits(json(ep), ["disposition"])) hit(ep, w); for (const f of json(ep).disposition ?? []) for (const w of objHits(f, ["value", "slug", "count"])) hit(ep, w); }
          else if (statSync(ep).isDirectory() && (/^page=\d+$/.test(e) || (depth === 0 && /^disp=[a-z0-9-]+$/.test(e)))) walk(ep, depth + 1);
          else hit(ep, e.startsWith("bench=") ? "bench filter is not allowed" : "unexpected entry");
        } };
        walk(yp, 0);
      }
      c.hits = hits.length - before;
    } else if (KEYS[top]) {
      for (const f of readdirSync(p)) { if (!want(f.replace(/\.json$/, ""))) continue; const v = json(path.join(p, f)); for (const o of Array.isArray(v) ? v : [v]) for (const w of objHits(o, KEYS[top])) hit(path.join(p, f), w); }
    } else if (top === "search") {
      for (const f of readdirSync(p)) {
        const fp = path.join(p, f);
        if (f === "meta.json") for (const w of objHits(json(fp), META)) hit(fp, w);
        else if (/^shard=\d{3}\.json$/.test(f)) { const words = Object.keys(json(fp)).filter((k) => !/^[#@]/.test(k)).length; if (words) hit(fp, `${words} word keys (only case-number "#" and year "@" keys are allowed)`); }
        else hit(fp, "unexpected entry");
      }
    } else hit(p, "unexpected entry");
  }
  return { per, hits };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), i = args.indexOf("--courts");
  const courts = i >= 0 && args[i + 1] ? args[i + 1].split(",") : null, dir = path.resolve(args.find((a, j) => !a.startsWith("--") && args[j - 1] !== "--courts") ?? "../lexbharat-data/judgments-hc-v2");
  const { per, hits } = checkDir(dir, courts);
  console.table(Object.fromEntries(Object.entries(per).sort().map(([k, v]) => [k, v])));
  if (hits.length) { console.error(`FAIL: ${hits.length} hits. First 20 (file, field and kind only; values are never printed):`); for (const h of hits.slice(0, 20)) console.error(`  ${h.file}  ${h.why}`); process.exit(1); }
  console.error(`PASS: no person field and no name pattern in ${Object.values(per).reduce((n, c) => n + c.rows, 0).toLocaleString("en-IN")} rows of ${Object.keys(per).length} courts. Judgment body text is not checked (see the header of this file).`);
}
