#!/usr/bin/env node
// docs/COVERAGE-PRIORITY.md: the Central Acts ranked by how many Supreme Court judgments cite them, with each Act's status in our library (complete / missing N sections / garbled / absent) and whether its most-cited sections are held.
// Reads the scan from scripts/acts/sc-citations-scan.mjs, our Central Acts (Neon + the text files in ../lexbharat-data/acts-text) and docs/PDF-DOWNLOAD-LIST.md. READ-ONLY on the database. Writes docs/COVERAGE-PRIORITY.md, docs/coverage/act-citations.json and re-ranks docs/PDF-DOWNLOAD-LIST.md.
// usage: node scripts/acts/coverage-priority.mjs <sc-citations.json> [--top 150]
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import { findGaps, maxCitedSection, robustMax } from "../../src/lib/acts/gaps.mjs";
import { knownMaxFor } from "../../src/lib/acts/knownCounts.mjs";
import { toSectionRecord } from "../../src/lib/acts/sectionRecord.mjs";
for (const l of fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const SCAN = process.argv[2], TOP = Number(process.argv[process.argv.indexOf("--top") + 1]) || 150, DIR = path.resolve("../lexbharat-data/acts-text");
if (!SCAN) { console.log("usage: node scripts/acts/coverage-priority.mjs <sc-citations.json> [--top 150]"); process.exit(1); }
const scan = JSON.parse(fs.readFileSync(SCAN, "utf8")), sql = neon(process.env.DATABASE_URL), aliasActs = JSON.parse(fs.readFileSync("src/config/statute-acts.json", "utf8"));
const NCASES = scan.cases.length;

// ---- our Central Acts
const meta = new Map((await sql.query("SELECT act_id, title, act_status, source_url FROM acts WHERE category = 'central'")).map((a) => [a.act_id, a]));
const idx = JSON.parse(fs.readFileSync(path.join(DIR, "_index.json"), "utf8")).filter((a) => a.jurisdiction === "central" && meta.has(a.actId));
// same title normalisation and matching as scripts/acts/rank-central-acts.mjs ("Code of Criminal Procedure, 1973" is cited without "Act")
const norm = (t) => { const m = /^(.*?\b[12]\d{3})\b/.exec(t.replace(/\([^)]*\)/g, " ").replace(/\b(?:no\.?\s*)?\d{1,3}\s+of\s+(?=[12]\d{3}\b)/gi, " ")); return (m ? m[1] : t).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, ""); };
const acts = idx.map((a) => ({ actId: a.actId, title: a.title, key: norm(a.title), sections: a.sections }));
const matchVariant = (k) => {
  const year = (/\b([12]\d{3})$/.exec(k) ?? [])[1]; if (!year) return null;
  const c = acts.filter((a) => a.key.endsWith(` ${year}`) && (a.key === k || a.key.endsWith(` ${k}`) || k.endsWith(` ${a.key}`) || a.key.replace(/ act (\d{4})$/, " $1") === k));
  c.sort((x, y) => y.key.length - x.key.length || y.sections - x.sections); return c[0] ?? null;
};
const sets = new Map(), secSets = new Map(), unmatched = [];   // actId -> Set(case idx);  actId -> Map(number -> Set)
const keyToAct = new Map();
for (const [k, list] of Object.entries(scan.variants)) {
  let a = null;
  if (k.startsWith("~")) { const id = aliasActs[k.slice(1)]; a = id ? acts.find((x) => x.actId === id) ?? { actId: id, title: meta.get(id)?.title ?? id } : null; } else a = matchVariant(k);
  if (!a) { unmatched.push({ name: k, cases: list.length }); continue; }
  keyToAct.set(k, a.actId); const s = sets.get(a.actId) ?? sets.set(a.actId, new Set()).get(a.actId); for (const i of list) s.add(i);
}
for (const [sk, list] of Object.entries(scan.sections)) {
  const bar = sk.lastIndexOf("|"), actId = keyToAct.get(sk.slice(0, bar)); if (!actId) continue;
  const num = sk.slice(bar + 1).toUpperCase(), m = secSets.get(actId) ?? secSets.set(actId, new Map()).get(actId); const s = m.get(num) ?? m.set(num, new Set()).get(num); for (const i of list) s.add(i);
}
const ranked = [...sets].map(([actId, s]) => ({ actId, cases: s.size, ...acts.find((a) => a.actId === actId), title: acts.find((a) => a.actId === actId)?.title ?? meta.get(actId)?.title ?? actId, meta: meta.get(actId) })).sort((a, b) => b.cases - a.cases).slice(0, TOP);

// ---- status of each ranked Act
const supp = await sql.query("SELECT act_id, number, replaces FROM act_sections_supplement");
const suppBy = new Map(); for (const s of supp) (suppBy.get(s.act_id) ?? suppBy.set(s.act_id, []).get(s.act_id)).push(s);
for (let i = 0; i < ranked.length; i += 8) await Promise.all(ranked.slice(i, i + 8).map(async (r) => {
  const sectionsHeld = await sql.query("SELECT upper(number) n, status FROM act_sections_v WHERE act_id = $1 AND number IS NOT NULL AND body IS NOT NULL", [r.actId]);
  const heldBy = new Map(sectionsHeld.map((x) => [x.n, x.status]));
  r.garbled = sectionsHeld.filter((x) => x.status === "garbled").length; r.incomplete = sectionsHeld.filter((x) => x.status === "possibly_incomplete").length; r.numbered = sectionsHeld.length;
  const top = [...(secSets.get(r.actId) ?? new Map())].map(([n, s]) => ({ number: n, cases: s.size })).sort((a, b) => b.cases - a.cases).slice(0, 8);
  r.topSections = top.map((t) => ({ ...t, state: !heldBy.has(t.number) ? "missing" : heldBy.get(t.number) === "garbled" ? "garbled" : "held" }));
  let d = null; try { d = JSON.parse(gunzipSync(fs.readFileSync(path.join(DIR, `act=${r.actId}.json.gz`)))); } catch { /* no text file */ }
  const allSecs = [...(secSets.get(r.actId) ?? new Map())].map(([n, st]) => ({ number: n, cases: st.size, state: !heldBy.has(n) ? "missing" : heldBy.get(n) === "garbled" ? "garbled" : "held" }));
  r.allSecs = allSecs; r.heldNums = [...heldBy.keys()];
  if (!r.numbered) { r.state = "absent"; r.missing = 0; r.confident = 0; r.expected = 0; return; }
  if (!d) { r.state = "present"; r.missing = 0; r.confident = 0; r.expected = 0; return; }   // held in the database but not in the text files (the Constitution): no gap analysis
  const sup = suppBy.get(r.actId) ?? [], filled = new Set(sup.filter((s) => /^\d/.test(s.number)).map((s) => s.number));
  const recs = d.sections.map((s, i) => ({ ...toSectionRecord(s, i), kind: s.kind })), numbered = recs.filter((x) => x.kind === "s" && x.number);
  const nums = [...new Set([...numbered.map((x) => x.number), ...filled])], heldMax = robustMax(nums.map((n) => parseInt(n, 10) || 0).filter(Boolean));
  const g = findGaps(nums, maxCitedSection(recs.map((x) => x.body ?? ""), heldMax), knownMaxFor(r.meta.title));
  r.held = nums.length; r.expected = g.expectedMax; r.missing = g.missing.length; r.confident = g.confident.length;
}));
// cited sections we do not hold (or hold scrambled). The scan reads prose with regexes, so a cited number is believed only if it is plausible for the Act: not above the Act's highest expected number (+15%),
// not an Order/Rule pair (those are not sections), and a number with a letter suffix needs 5+ judgments (plain numbers 3+). Judgments citing a section we lack are summed over sections (a judgment citing two counts twice).
const plausible = (r, t) => {
  if (/^O\d+R\d+/.test(t.number)) return false;
  const bare = t.number.replace(/^A/, ""), n = parseInt(bare, 10) || 0, heldMax = Math.max(0, ...(r.heldNums ?? []).map((x) => parseInt(x.replace(/^A/, ""), 10) || 0).filter((x) => x < 2000));
  const max = Math.max(r.expected || 0, heldMax) || (r.title.includes("Constitution") ? 395 : 1500);
  if (n < 1 || n > max * 1.15) return false;
  return /[A-Z]$/.test(bare) ? t.cases >= 5 : t.cases >= 3;
};
for (const r of ranked) {
  r.lost = (r.allSecs ?? []).filter((t) => t.state !== "held" && plausible(r, t)).sort((a, b) => b.cases - a.cases);
  r.lostCases = r.lost.reduce((n, t) => n + t.cases, 0);
  if (r.state === "absent") { r.lost = (r.allSecs ?? []).filter((t) => plausible(r, t)).sort((a, b) => b.cases - a.cases); r.lostCases = r.lost.reduce((n, t) => n + t.cases, 0) || r.cases; }
}
// a most-cited section we lack counts only when it is cited in 10+ judgments (a stray regex hit on a rare number should not put an Act on the list)
const topMissing = (r) => (r.lost ?? []).filter((t) => (/[A-Z]$/.test(t.number.replace(/^A/, "")) ? t.cases >= 25 : t.cases >= 10));   // a lettered number (113A) needs more judgments: regex noise such as 19L shows up there
const statusText = (r) => {
  if (r.state === "absent") return "**absent** (title only, no text)";
  const parts = [];
  if (r.missing) parts.push(`missing ${r.missing} section${r.missing === 1 ? "" : "s"}${r.confident ? ` (${r.confident} confident)` : ""}`);
  if (r.garbled) parts.push(`${r.garbled} garbled`);
  return parts.length ? parts.join("; ") : "complete";
};
// needs a download: absent, a confident missing number, garbled text, or a section cited in 10+ judgments that we lack
const needs = (r) => r.state === "absent" || r.confident > 0 || r.garbled > 0 || topMissing(r).length > 0;
ranked.forEach((r, i) => { r.rank = i + 1; r.lost ??= []; r.lostCases ??= 0; r.needs = needs(r); r.status = statusText(r); });

// ---- write the outputs
fs.mkdirSync("docs/coverage", { recursive: true });
fs.writeFileSync("docs/coverage/act-citations.json", JSON.stringify({ at: new Date().toISOString(), judgmentsScanned: NCASES, acts: ranked.map((r) => ({ rank: r.rank, actId: r.actId, title: r.title, judgments: r.cases, status: r.status, needsDownload: r.needs, topSections: r.topSections, lostCases: r.lostCases, lostSections: r.lost.slice(0, 10) })) }, null, 1));
const lostCell = (r) => r.lost.slice(0, 4).map((t) => `${t.number} (${t.cases})${t.state === "garbled" ? " garbled" : ""}`).join(", ") || "none cited";
const sectionCell = (r) => r.topSections.slice(0, 5).map((t) => `${t.number} (${t.cases})${t.state === "held" ? "" : t.state === "garbled" ? " **garbled**" : " **missing**"}`).join(", ") || "n/a";
const esc = (s) => String(s).replace(/\|/g, "/");
// how India Code prints the title: no "1 of 1872", no "(Rep., Act 47 of 2023)" (repealed Acts get an italic tag instead)
const show = (r) => `${r.title.replace(/\([^)]*\)/g, " ").replace(/,?\s*\d{1,3}\s+of\s+(?=[12]\d{3})/gi, ", ").replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/,\s*$/, "").replace(/(\b[12]\d{3})\b.*$/, "$1").trim()}${/Rep\.|repealed/i.test(r.title) || r.meta?.act_status === "repealed" ? " *(repealed)*" : ""}`;
const download = ranked.filter((r) => r.needs).sort((a, b) => b.lostCases - a.lostCases || b.cases - a.cases).slice(0, 20);   // ordered by how many judgments cite a section we lack
const md = [];
md.push(`# Coverage priority: Central Acts by Supreme Court citations\n`);
md.push(`Generated by \`scripts/acts/coverage-priority.mjs\` from \`scripts/acts/sc-citations-scan.mjs\` on ${new Date().toISOString().slice(0, 10)}. **Reports only; nothing was fetched or changed.**\n`);
md.push(`**How the ranking works.** The scan read the full text of all ${NCASES.toLocaleString("en-IN")} Supreme Court judgments in our database. An Act's number is the count of DISTINCT judgments that name it ("Indian Penal Code, 1860" and "Penal Code, 1860" are added together; short forms such as IPC, CrPC, CPC and NI Act count for the 17 Acts listed in \`src/lib/judgments/statuteLinks.mjs\`). The names are matched to our Central Acts by title and year, as in \`rank-central-acts.mjs\`. The "top sections" are the sections cited most often together with that Act (the number in brackets is the judgments citing it); they are found by regex on prose, so treat them as a ranking, not an exact count. Judgments decided before 2024 cannot cite the new codes (BNS, BNSS, BSA), so those rank lower than their real importance; they stay on the download list for that reason.\n`);
md.push(`**Status.** *complete*: no gap found. *missing N sections*: numbers absent from 1..N by the rule in \`docs/MISSING-SECTIONS.md\` (most are "uncertain"; "confident" ones are the ones the Act page warns about). *garbled*: sections whose text is scrambled in the source. *absent*: the Act has no text in our library. **Needs a download** = absent, or a confident gap, or garbled text, or a section cited in 10 or more judgments that we do not hold (or hold scrambled). The top-20 order is the sum, over the sections we lack, of the judgments citing each (a judgment citing two such sections counts twice); an absent Act counts every section cited.\n`);
md.push(`## Top 20 to download first (ordered by how many judgments cite a section we lack)\n`);
md.push(`| # | Act | Judgments citing the Act | What is wrong | Cited sections we lack: judgments citing them (sum) | Biggest ones (judgments) |\n|---:|---|---:|---|---:|---|`);
download.forEach((r, i) => md.push(`| ${i + 1} | ${esc(show(r))} | ${r.cases} | ${esc(r.status)} | ${r.lostCases} | ${esc(lostCell(r))} |`));
md.push(`\nRows 1-20 are in \`docs/PDF-DOWNLOAD-LIST.md\` in this order where the Act is on that list; the rest of this table shows why.\n`);
md.push(`## Top ${TOP} Central Acts by citations\n`);
md.push(`| Rank | Act | Judgments | Status | Needs download | Most-cited sections (judgments) |\n|---:|---|---:|---|:---:|---|`);
for (const r of ranked) md.push(`| ${r.rank} | ${esc(show(r))} | ${r.cases} | ${esc(r.status)} | ${r.needs ? "yes" : ""} | ${esc(sectionCell(r))} |`);
const topNames = unmatched.filter((u) => u.cases >= 40).sort((a, b) => b.cases - a.cases).slice(0, 30);
md.push(`\n## Names judgments use that match no Central Act in our library (top ${topNames.length}, 40+ judgments)\n`);
md.push(`These are either State Acts (we hold those separately), Acts with a name or year we could not match, or Acts that are **absent** from our library. Check them by hand before downloading.\n`);
md.push(`| Name as written (lower case) | Judgments |\n|---|---:|`); for (const u of topNames) md.push(`| ${esc(u.name)} | ${u.cases} |`);
md.push(`\nSummary: ${ranked.length} Acts ranked; ${ranked.filter((r) => r.needs).length} need a download by the rule above; ${ranked.filter((r) => r.status === "complete").length} are complete; ${ranked.filter((r) => r.state === "absent").length} have no text.\n`);
fs.writeFileSync("docs/COVERAGE-PRIORITY.md", md.join("\n"));
console.log(`ranked ${ranked.length}; need download ${ranked.filter((r) => r.needs).length}; unmatched names kept ${unmatched.length}`);
console.log("top 20 to download:"); for (const r of download) console.log(` ${r.lostCases}\t${r.cases}\t${r.title.slice(0, 55)}\t${r.status}\t${lostCell(r)}`);
