#!/usr/bin/env node
// W10 item 11: restores case lists for High Court years where the dataset has far fewer cases than the AWS Open Data release (s3://indian-high-court-judgments, public). METADATA ONLY: the PDFs were not downloaded.
// Metadata Parquet files are in ../lexbharat-data/aws-hc-meta. Case ids in the dataset ARE the court's CNR, so the two are merged by CNR: every case already listed stays untouched; AWS cases whose CNR is not listed are added.
// An added case carries: id (CNR), title, decision date, disposition (as recorded), date of registration. No case number, parties, judges or pages (the AWS record has none we can verify).
// Rewrites that court-year's pages under ../lexbharat-data/judgments-hc (main list, disposition and bench lists, facets), _manifest, src/data/judgments/court-years.json + courts.meta.json, and src/config/hc-aws-years.json.
// usage: node scripts/w10/hc-merge-aws.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const APPLY = process.argv.includes("--apply"), ROOT = "../lexbharat-data/judgments-hc", AWS = "../lexbharat-data/aws-hc-meta", PER = 100;
const COURTS = { "3_22": "punjab-and-haryana-high-court", "9_13": "allahabad-high-court", "23_23": "madhya-pradesh-high-court", "24_17": "gujarat-high-court", "33_10": "madras-high-court", "7_26": "delhi-high-court", "29_3": "karnataka-high-court" };
const PAIRS = [["3_22", 2012], ["3_22", 2023], ["9_13", 2024], ["23_23", 2024], ["24_17", 2009], ["24_17", 2016], ["33_10", 2012], ["7_26", 2009], ["29_3", 2013]];   // Gujarat 2023 and Delhi 2021 already hold as many cases as AWS
const LABEL = { DISMISSED: "Dismissed", ALLOWED: "Allowed", DISPOSED: "Disposed of", "DISPOSED OF": "Disposed of", "DISPOSED OFF": "Disposed of", REJECTED: "Rejected", "BAIL GRANTED": "Bail granted", "BAIL REJECTED": "Bail rejected", CLOSED: "Closed", WITHDRAWN: "Withdrawn",
  "PARTLY ALLOWED": "Partly allowed", QUASHED: "Quashed", REMANDED: "Remanded", ACQUITTED: "Acquitted", CONVICTED: "Convicted", GRANTED: "Granted", "DISMISSED AS INFRUCTUOUS": "Dismissed as infructuous", "DISMISSED AS WITHDRAWN": "Dismissed as withdrawn", "DISMISSED ON MERITS": "Dismissed on merits" };
const slugOf = (s) => s.toLowerCase().replace(/ /g, "-");
const clean = (t) => { const x = String(t ?? "").replace(/\s*\bNone\s*$/, "").replace(/^None\s+/, "").replace(/\s+/g, " ").trim(); return x && x !== "None" ? x : null; };

const report = [], restored = JSON.parse(fs.existsSync("src/config/hc-aws-years.json") ? fs.readFileSync("src/config/hc-aws-years.json", "utf8") : '{"_note":"","years":{}}');
restored._note = "High Court years whose case list was extended in W10 with cases from the AWS Open Data metadata (CNR not already listed). Metadata only; no judgment text. Written by scripts/w10/hc-merge-aws.mjs.";
for (const [code, year] of PAIRS) {
  const slug = COURTS[code], dir = path.join(ROOT, `court=${slug}`, `year=${year}`);
  const files = fs.readdirSync(AWS).filter((f) => f.startsWith(`year=${year}__court=${code}__`)).map((f) => path.join(AWS, f));
  const nd = execFileSync("duckdb", ["-json", "-c", `SELECT cnr, arg_max(title, decision_date) AS title, strftime(max(decision_date), '%Y-%m-%d') AS dd, arg_max(disposal_nature, decision_date) AS disp, arg_max(date_of_registration, decision_date) AS reg FROM read_parquet([${files.map((f) => `'${f}'`).join(",")}]) WHERE cnr IS NOT NULL GROUP BY cnr`], { maxBuffer: 1 << 30 }).toString();
  const aws = JSON.parse(nd || "[]");
  const existing = [];
  if (fs.existsSync(dir)) for (const p of fs.readdirSync(dir).filter((x) => /^page=\d+$/.test(x))) existing.push(...JSON.parse(fs.readFileSync(path.join(dir, p, "data_0.json"), "utf8")));
  const have = new Set(existing.map((c) => c.caseId)), added = [];
  for (const r of aws) {
    if (have.has(r.cnr)) continue;
    const disp = clean(r.disp), label = disp ? LABEL[disp.toUpperCase()] : undefined;
    added.push({ caseId: r.cnr, ...(clean(r.title) ? { title: clean(r.title) } : {}), ...(r.dd ? { decisionDate: r.dd } : {}), ...(disp ? { disposition: disp } : {}), ...(label ? { dispositionLabel: label } : {}), ...(clean(r.reg) ? { dateOfRegistration: clean(r.reg) } : {}) });
  }
  report.push({ slug, year, existing: existing.length, aws: aws.length, added: added.length });
  if (!APPLY || !added.length) continue;
  const all = [...existing, ...added].sort((a, b) => (b.decisionDate ?? "").localeCompare(a.decisionDate ?? "") || (a.caseId < b.caseId ? -1 : 1));
  all.forEach((c, i) => { c._p = Math.floor(i / PER) + 1; });
  fs.rmSync(dir, { recursive: true, force: true });
  const write = (sub, rows) => { fs.mkdirSync(path.join(dir, sub), { recursive: true }); fs.writeFileSync(path.join(dir, sub, "data_0.json"), JSON.stringify(rows)); };
  const strip = ({ _p, ...c }) => c, pages = Math.ceil(all.length / PER);
  for (let p = 1; p <= pages; p++) write(`page=${p}`, all.slice((p - 1) * PER, p * PER).map(strip));
  const facet = (kind, keyOf) => {
    const groups = new Map(); for (const c of all) { const k = keyOf(c); if (k) (groups.get(k) ?? groups.set(k, []).get(k)).push(c); }
    for (const [k, rows] of groups) for (let p = 1; p <= Math.ceil(rows.length / PER); p++) write(`${kind}=${k}/page=${p}`, rows.slice((p - 1) * PER, p * PER).map((c) => ({ mainPage: c._p, ...strip(c) })));
    return groups;
  };
  const disp = facet("disp", (c) => (c.dispositionLabel ? c.dispositionLabel.toLowerCase().replace(/ /g, "-") : null));
  const bench = facet("bench", (c) => (c.benchSize === 1 ? "single" : c.benchSize === 2 ? "division" : c.benchSize >= 3 ? "larger" : null));
  const facets = { disposition: [...disp].map(([slugD, rows]) => ({ value: rows[0].dispositionLabel, slug: slugD, count: rows.length })).sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1)), ...(bench.size ? { bench: [...bench].map(([value, rows]) => ({ value, count: rows.length })).sort((a, b) => b.count - a.count) } : {}) };
  fs.writeFileSync(path.join(dir, "facets.json"), JSON.stringify(facets));
  const mp = path.join(ROOT, "_manifest", `${slug}.json`), man = JSON.parse(fs.readFileSync(mp, "utf8")), row = man.find((m) => m.year === year);
  if (row) { row.cases = all.length; row.pages = pages; } else man.push({ year, cases: all.length, pages }), man.sort((a, b) => b.year - a.year);
  fs.writeFileSync(mp, "[\n" + man.map((m) => "\t" + JSON.stringify(m)).join(",\n") + "\n]\n");
  const cy = JSON.parse(fs.readFileSync("src/data/judgments/court-years.json", "utf8")), cr = cy.find((r) => r.court === slug && r.year === year);
  if (cr) cr.cases = all.length; else cy.push({ court: slug, year, cases: all.length });
  fs.writeFileSync("src/data/judgments/court-years.json", "[\n" + cy.map((r) => "\t" + JSON.stringify(r)).join(",\n") + "\n]\n");
  const cm = JSON.parse(fs.readFileSync("src/data/judgments/courts.meta.json", "utf8")), cc = cm.find((r) => r.court === slug);
  if (cc) cc.cases += added.length;
  fs.writeFileSync("src/data/judgments/courts.meta.json", "[\n" + cm.map((r) => "\t" + JSON.stringify(r)).join(",\n") + "\n]\n");
  (restored.years[slug] ??= {})[year] = { added: added.length, awsCases: aws.length, listedBefore: existing.length };
}
console.table(report);
if (APPLY) fs.writeFileSync("src/config/hc-aws-years.json", JSON.stringify(restored, null, 1) + "\n");
