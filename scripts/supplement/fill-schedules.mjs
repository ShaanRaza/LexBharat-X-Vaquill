// Writes one fill-in file per Order, Rule (CPC First Schedule), Article (Limitation Act Schedule) and Article (Indian Stamp Act Schedule I, Central text) into content/supplement/schedules/.
// Same method as the sections: the text comes only from the Act PDFs in content/supplement/pdfs/ and every word is checked to be in the PDF's own text; units that fail are listed and not written.
// usage: node scripts/supplement/fill-schedules.mjs [--dry-run] [--date=YYYY-MM-DD]
import fs from "node:fs";
import { checkAgainstPdf } from "./extract-sections.mjs";
import { listSections } from "./list-sections.mjs";
import { pdfLines } from "./pdf-text.mjs";
import { cpcUnits, limitationUnits, stampUnits } from "./schedules.mjs";
const args = process.argv.slice(2), DRY = args.includes("--dry-run"), date = (args.find((a) => a.startsWith("--date=")) ?? "").slice(7) || new Date().toISOString().slice(0, 10);
const OUT = "content/supplement/schedules";
const ACTS = [
  { key: "cpc", pdf: "cpc-1908", actId: "IND_central_2191", name: "The Code of Civil Procedure, 1908", file: "a1908-05.pdf", bit: "fc9dad3f-97a9-4216-843b-934665693468", what: "First Schedule (Orders and Rules)" },
  { key: "limitation", pdf: "limitation-act-1963", actId: "IND_central_1565", name: "The Limitation Act, 1963", file: "A1963-36.pdf", bit: "8c2f3bc0-5daf-4d11-971f-ad5f9b78b74b", what: "Schedule (Articles)" },
  { key: "stamp", pdf: "stamp-act-1899", actId: "IND_central_15510", name: "The Indian Stamp Act, 1899", file: "a1899-2_.pdf", bit: "dc504bf4-89fc-4298-8ce6-edc6da5731d0", what: "Schedule I (Articles; Central text, most States have their own rates)" },
];
fs.mkdirSync(OUT, { recursive: true });
const report = {};
for (const act of ACTS) {
  const path = `content/supplement/pdfs/${act.pdf}.pdf`, lines = await pdfLines(path), last = listSections(lines).at(-1).line;
  let units = act.key === "cpc" ? cpcUnits(lines, last) : act.key === "limitation" ? limitationUnits(lines) : stampUnits(lines, last);
  if (act.key === "cpc") {
    // an Order's own unit lists its Rules (their headings as printed)
    for (const u of units) if (u.kind === "order") { const rs = units.filter((r) => r.kind === "rule" && r.order === u.order && r.orderSuffix === u.orderSuffix && r.ok); u.pages = [lines[u.line].page, Math.max(lines[u.line].page, ...rs.map((r) => r.pages?.[1] ?? 0))]; u.text = `${u.heading}${rs.length ? `\nRules in this Order:\n${rs.map((r) => `${r.rule}. ${r.heading}`).join("\n")}` : ""}`; u.checkText = `${u.heading} ${rs.map((r) => r.heading).join(" ")}`; }
  } else {
    units.forEach((u, k) => { if (!u.pages) { const nx = units[k + 1]; u.pages = [lines[u.line].page, nx ? lines[Math.max(u.line, nx.line - 1)].page : lines[u.line].page + 1]; } });
  }
  const stat = { found: units.length, written: 0, failed: [], omitted: 0, orders: 0, rules: 0 };
  for (const u of units) {
    if (!u.ok) { stat.failed.push(`${u.number} (${u.why})`); continue; }
    const body = u.checkText ?? (act.key === "limitation" ? `${u.description} ${u.periodText} ${u.fromText}` : u.text);
    const bad = checkAgainstPdf(path, { heading: u.kind === "order" || act.key !== "cpc" ? "" : u.heading, text: body, pages: u.pages }, { loose: true });
    if (bad) { stat.failed.push(`${u.number} (word "${bad}" not found in the PDF)`); continue; }
    if (u.kind === "order") stat.orders++; else if (u.kind === "rule") stat.rules++;
    const heading = (u.heading ?? "").replace(/\s+/g, " ").replace(/\s*\*+$/, "").slice(0, 190);
    const text = u.text;
    const file = `${OUT}/${act.key}-${u.number.toLowerCase()}.txt`;
    if (!DRY) fs.writeFileSync(file, [`# FILL-IN FILE: ${act.name}, ${act.what}, unit ${u.number}.`, `# Extracted ${date} from India Code's PDF ${act.file} by scripts/supplement/fill-schedules.mjs. Every word was checked to be in the PDF. Printed amendment marks ([ ], * * *) are kept as printed; footnotes and state amendments are left out.`, ...(act.key === "stamp" ? ["# Central Government rates as printed in this PDF. Most States have their own rates (and the printed rates are old)."] : []),
      `Act: ${act.name}`, `Act ID: ${act.actId}`, `Section: ${u.number}`, `Heading: ${heading}`, "Replaces existing text: no", "Source: India Code", `Source URL: https://indiacode.gov.in/server/api/core/bitstreams/${act.bit}/content`, `Date copied: ${date}`, "=== SECTION TEXT (paste below this line) ===", text, ""].join("\n"));
    stat.written++;
  }
  report[act.key] = stat; console.log(act.key, JSON.stringify({ ...stat, failed: stat.failed.length }), stat.failed.slice(0, 40).join("; "));
}
fs.writeFileSync("/tmp/schedules-report.json", JSON.stringify(report, null, 1));
