// Writes one fill-in file per Article and per Schedule of the Constitution of India into content/supplement/schedules/ (constitution-a21.txt, constitution-s7.txt). Text only from the PDF
// content/supplement/pdfs/constitution-of-india.pdf; every word is checked to be in the PDF's own text, and a second check counts the PDF's words of each Article that did NOT make it into the unit.
// usage: node scripts/supplement/fill-constitution.mjs [--dry-run] [--date=YYYY-MM-DD]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { checkAgainstPdf } from "./extract-sections.mjs";
import { appendixUnits, articleUnits, constitutionLines, isCrossHeading, preambleUnit, scheduleUnits } from "./constitution.mjs";
const args = process.argv.slice(2), DRY = args.includes("--dry-run"), date = (args.find((a) => a.startsWith("--date=")) ?? "").slice(7) || new Date().toISOString().slice(0, 10);
const FILE = "content/supplement/pdfs/constitution-of-india.pdf", OUT = "content/supplement/schedules", ACT_ID = "IND_central_COI", NAME = "The Constitution of India";
const URL_ = "https://indiacode.gov.in/pdf-viewer/6d37d94f-edcd-4aae-9947-b55246a882a0/89650f12-c019-46ff-b1f1-6779e59d3936";
const info = execFileSync("pdfinfo", [FILE]).toString(), title = /Title:\s+(.*)/.exec(info)?.[1] ?? "";
const words = (s) => String(s).toLowerCase().normalize("NFKC").replace(/(\p{L})-\s*(?=\p{L})/gu, "$1").match(/\p{L}+|\p{N}+/gu) ?? [];
const lines = await constitutionLines(FILE), arts = articleUnits(lines), sch = scheduleUnits(lines, arts.at(-1).line);
fs.mkdirSync(OUT, { recursive: true });
const stat = { articles: 0, schedules: 0, failed: [], thin: [] };
const write = (u, kind) => {
  const heading = (u.heading ?? "").replace(/\s+/g, " ").replace(/\s*\*+$/, "").slice(0, 190), text = u.text;
  const label = kind === "article" ? `Article ${u.number.replace(/^A/, "")}` : u.heading;   // the Preamble and the Schedules are named by their heading
  const body = [
    `# FILL-IN FILE: ${NAME}, ${label}.`,
    `# Extracted ${date} from India Code's PDF "${title}" (Legislative Department pocket edition, "As on 10th September, 2026", amendments up to the Constitution (One Hundred and Sixth Amendment) Act, 2023, the latest Constitution Amendment Act we know of: check India Code for any newer one) by scripts/supplement/fill-constitution.mjs. Every word was checked to be in the PDF. Printed amendment marks ([ ], * * *) are kept as printed; footnotes and page headings are left out.`,
    `Act: ${NAME}`, `Act ID: ${ACT_ID}`, `Section: ${u.id}`, `Heading: ${heading}`, ...(u.chapter ? [`Chapter: ${u.chapter}`] : []), "Replaces existing text: no", "Source: India Code", `Source URL: ${URL_}`, `Date copied: ${date}`, "=== SECTION TEXT (paste below this line) ===", text, ""].join("\n");
  if (!DRY) fs.writeFileSync(`${OUT}/constitution-${u.id.toLowerCase()}.txt`, body);
};
for (const u of arts) {
  u.id = `A${u.number}`;
  if (!u.ok) { stat.failed.push(`${u.id} (${u.why})`); continue; }
  const bad = checkAgainstPdf(FILE, { heading: u.heading, text: u.text, pages: u.pages }, { loose: true });
  if (bad) { stat.failed.push(`${u.id} (word "${bad}" not found in the PDF)`); continue; }
  // completeness: words printed for this Article (minus cross-headings and the Part/Chapter lines) that are missing from the unit
  const pdfWords = words(lines.slice(u.line, u.line + u.lineCount).filter((l, k) => k === 0 || !isCrossHeading(l)).filter((l) => !/^\[?(PART|CHAPTER)\s/.test(l.text)).map((l, k) => (k === 0 ? l.text.replace(/^\[?\s*\d{1,3}[A-Z]{0,3}\.\s*/, "") : l.text)).join(" ")), have = new Map();
  for (const w of words(`${u.heading} ${u.text}`)) have.set(w, (have.get(w) ?? 0) + 1);
  let miss = 0; for (const w of pdfWords) { const n = have.get(w) ?? 0; if (n > 0) have.set(w, n - 1); else miss++; }
  if (pdfWords.length && miss / pdfWords.length > 0.03) stat.thin.push(`${u.id} (${miss} of ${pdfWords.length} words of the PDF's lines are not in the unit)`);
  write(u, "article"); stat.articles++;
}
for (const u of sch) {
  u.id = `S${u.n}`;
  const bad = checkAgainstPdf(FILE, { heading: u.heading, text: u.text, pages: u.pages }, { loose: true });
  if (bad) { stat.failed.push(`${u.id} (word "${bad}" not found in the PDF)`); continue; }
  write(u, "schedule"); stat.schedules++;
}
for (const u of appendixUnits(lines, arts.at(-1).line)) {
  u.id = u.number;
  const bad = checkAgainstPdf(FILE, { heading: u.heading.split(" — ")[0], text: u.text,  /* the title is already the first line of the text */ pages: u.pages }, { loose: true });
  if (bad) { stat.failed.push(`${u.id} (word "${bad}" not found in the PDF)`); continue; }
  write(u, "appendix"); stat.appendices = (stat.appendices ?? 0) + 1;
}
const pre = preambleUnit(lines);
if (pre) { pre.id = "PREAMBLE"; const bad = checkAgainstPdf(FILE, { heading: pre.heading, text: pre.text, pages: pre.pages }, { loose: true }); if (bad) stat.failed.push(`PREAMBLE (word "${bad}" not found in the PDF)`); else { write(pre, "preamble"); stat.preamble = 1; } } else stat.failed.push("PREAMBLE (not found)");
console.log(JSON.stringify({ preamble: stat.preamble ?? 0, appendices: stat.appendices ?? 0, articles: stat.articles, of: arts.length, schedules: stat.schedules, of_schedules: sch.length, failed: stat.failed.length, thin: stat.thin.length }));
console.log("FAILED:", stat.failed.join("; ") || "none"); console.log("THIN (more than 3% of the PDF's words missing):", stat.thin.join("; ") || "none");
