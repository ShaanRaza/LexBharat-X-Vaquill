// Fills EVERY section of the 8 Acts that is missing or holds wrong text in our data, from the Act PDFs in content/supplement/pdfs/ (same extraction as the first 30: scripts/supplement/pdf-text.mjs,
// list-sections.mjs, extract-sections.mjs; every word is checked to be in the PDF). A section counts as
//   missing  - no row with that number in the Act's open-india-law rows;
//   wrong    - a row exists but its text does not match the PDF: fewer than 90% of the PDF's words are in it, or fewer than 60% of its words are in the PDF section (it is mixed with other text), or it has no text.
// Writes one file per section into content/supplement/ (never over an existing file), then you run `npm run load:supplement`. usage: node scripts/supplement/fill-all.mjs [--dry-run] [--date=YYYY-MM-DD] [--only=cpc]
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { cutSection, checkAgainstPdf } from "./extract-sections.mjs";
import { listSections } from "./list-sections.mjs";
import { pdfLines } from "./pdf-text.mjs";
for (const l of fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8").split("\n") : []) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const args = process.argv.slice(2), DRY = args.includes("--dry-run"), only = (args.find((a) => a.startsWith("--only=")) ?? "").slice(7), date = (args.find((a) => a.startsWith("--date=")) ?? "").slice(7) || new Date().toISOString().slice(0, 10);
const ACTS = [
  { key: "contract", pdf: "contract-act-1872", actId: "IND_central_2187", name: "The Indian Contract Act, 1872", file: "a1872-9.pdf", bit: "e7571d39-11a7-4a2c-86e3-c515ae43e617" },
  { key: "cpc", pdf: "cpc-1908", actId: "IND_central_2191", name: "The Code of Civil Procedure, 1908", file: "a1908-05.pdf", bit: "fc9dad3f-97a9-4216-843b-934665693468" },
  { key: "limitation", pdf: "limitation-act-1963", actId: "IND_central_1565", name: "The Limitation Act, 1963", file: "A1963-36.pdf", bit: "8c2f3bc0-5daf-4d11-971f-ad5f9b78b74b" },
  { key: "ni", pdf: "ni-act-1881", actId: "IND_central_2189", name: "The Negotiable Instruments Act, 1881", file: "a1881-26.pdf", bit: "82bf1927-5e52-4aab-a876-50552c5952cd" },
  { key: "sra", pdf: "specific-relief-act-1963", actId: "IND_central_1583", name: "The Specific Relief Act, 1963", file: "A1963-47.pdf", bit: "aba411f8-4c8d-4c8e-af29-64d442ae80f0" },
  { key: "pca", pdf: "prevention-of-corruption-act-1988", actId: "IND_central_1558", name: "The Prevention of Corruption Act, 1988", file: "a1988-49.pdf", bit: "54dfd58e-7946-4041-b25d-5e0c85ba9aca" },
  { key: "hma", pdf: "hindu-marriage-act-1955", actId: "IND_central_1560", name: "The Hindu Marriage Act, 1955", file: "a1955-25.pdf", bit: "526166d6-239d-4b6c-8999-c776179dea69" },
  { key: "stamp", pdf: "stamp-act-1899", actId: "IND_central_15510", name: "The Indian Stamp Act, 1899", file: "a1899-2_.pdf", bit: "dc504bf4-89fc-4298-8ce6-edc6da5731d0" },
];
const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
import { execFileSync } from "node:child_process";
const created = (pdf) => { const m = /CreationDate:\s+\w{3}\s+(\w{3})\s+(\d+)\s+[\d:]+\s+(\d{4})/.exec(execFileSync("pdfinfo", [`content/supplement/pdfs/${pdf}.pdf`]).toString()); return m ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}` : "an unknown date"; };
const words = (s) => String(s).toLowerCase().normalize("NFKC").replace(/(\p{L})-\s*(?=\p{L})/gu, "$1").match(/\p{L}+|\p{N}+/gu) ?? [];
const count = (a) => a.reduce((m, w) => m.set(w, (m.get(w) ?? 0) + 1), new Map());
/** How much of `a` (as a bag of words) is in `b`: 0..1. */
const covered = (a, b) => { const A = words(a), B = count(words(b)); if (!A.length) return 1; let hit = 0; for (const w of A) { const n = B.get(w) ?? 0; if (n > 0) { hit++; B.set(w, n - 1); } } return hit / A.length; };

const sql = neon(process.env.DATABASE_URL);
const pad = (n) => n.replace(/^(\d+)/, (d) => d.padStart(3, "0"));
const summary = [];
for (const act of ACTS.filter((a) => !only || a.key === only)) {
  const lines = await pdfLines(`content/supplement/pdfs/${act.pdf}.pdf`), list = listSections(lines), pdfDate = created(act.pdf);
  const rows = await sql.query("select number, section_key, status, body from act_sections where act_id = $1 and number is not null", [act.actId]);
  const byNum = new Map(); for (const r of rows) { const k = r.number.toUpperCase(); (byNum.get(k) ?? byNum.set(k, []).get(k)).push(r); }
  const stat = { listed: list.length, ok: 0, missing: 0, wrong: 0, already: 0, unsure: 0, files: 0 }, unsure = [], wrongList = [], missingList = [];
  for (const c of list) {
    const file = `content/supplement/${act.key}-section-${pad(c.number)}.txt`;
    if (fs.existsSync(file)) { stat.already++; continue; }
    const sec = cutSection(lines, c.number, c.line);
    if (!sec.ok) { stat.unsure++; unsure.push(`${c.number}: ${sec.why}`); continue; }
    const bad = checkAgainstPdf(`content/supplement/pdfs/${act.pdf}.pdf`, sec);
    if (bad) { stat.unsure++; unsure.push(`${c.number}: word "${bad}" not found in the PDF`); continue; }
    const have = byNum.get(c.number.toUpperCase()) ?? [];
    let kind = "missing", why = "";
    if (have.length) {
      const pdfText = `${sec.heading} ${sec.text}`, best = have.map((r) => ({ r, rec: r.body ? covered(pdfText, r.body) : 0, pre: r.body ? covered(r.body, pdfText) : 0 })).sort((a, b) => b.rec + b.pre - (a.rec + a.pre))[0];
      if (best.r.status !== "garbled" && best.r.body && best.rec >= 0.9 && best.pre >= 0.6) { stat.ok++; continue; }
      kind = "wrong"; stat[best.r.body ? (best.rec < 0.9 ? "incomplete" : "mixed") : "noText"] = (stat[best.r.body ? (best.rec < 0.9 ? "incomplete" : "mixed") : "noText"] ?? 0) + 1;
      if (args.includes("--sample") && Math.random() < 0.05) console.log(`   sample ${act.key} ${c.number}: rec ${best.rec.toFixed(2)} pre ${best.pre.toFixed(2)} | DB: ${(best.r.body ?? "").replace(/\s+/g, " ").slice(0, 110)} | PDF: ${pdfText.replace(/\s+/g, " ").slice(0, 110)}`);
      why = `our data holds ${best.r.body ? `text with ${Math.round(best.rec * 100)}% of the PDF's words, of which ${Math.round(best.pre * 100)}% of its own words are in the PDF` : "no usable text (marked unreliable)"}`;
    }
    stat[kind]++; (kind === "wrong" ? wrongList : missingList).push(c.number);
    if (DRY) continue;
    const head = [`# FILL-IN FILE: ${act.name}, section ${c.number}.`,
      `# Extracted ${date} from India Code's PDF ${act.file} (the PDF was created ${pdfDate}; amendments made after that date are not in it) by scripts/supplement/fill-all.mjs.`,
      "# Every word was checked to be in the PDF. Printed amendment marks ([ ], * * *) are kept as printed; footnote numbers, footnotes and state amendments are left out.",
      ...(kind === "wrong" ? [`# This section REPLACES text already in our data: ${why}.`] : ["# This section was MISSING from our data."]),
      ...(sec.repealed ? ["# NOTE: this section is repealed or omitted: the text is only the note saying so."] : []),
      `Act: ${act.name}`, `Act ID: ${act.actId}`, `Section: ${c.number}`, `Heading: ${sec.heading}`, `Replaces existing text: ${kind === "wrong" ? "yes" : "no"}`, "Source: India Code",
      `Source URL: https://indiacode.gov.in/server/api/core/bitstreams/${act.bit}/content`, `Date copied: ${date}`, "=== SECTION TEXT (paste below this line) ==="];
    fs.writeFileSync(file, `${head.join("\n")}\n${sec.text}\n`); stat.files++;
  }
  summary.push({ act: act.name, ...stat, wrongList, missingList, unsure });
  console.log(`${act.name}: listed ${stat.listed}; already filled ${stat.already}; fine in our data ${stat.ok}; MISSING ${stat.missing}; WRONG ${stat.wrong}; unsure ${stat.unsure}; files written ${stat.files} | wrong = ${stat.incomplete ?? 0} incomplete/different, ${stat.mixed ?? 0} complete but mixed with other text, ${stat.noText ?? 0} no usable text`);
  if (unsure.length) console.log("   unsure:", unsure.slice(0, 8).join(" | "));
}
fs.writeFileSync("/tmp/fill-all-summary.json", JSON.stringify(summary, null, 1));
