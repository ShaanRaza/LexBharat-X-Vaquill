// Fills the fill-in files of content/supplement/ from the extraction (extract-all.mjs JSON): Heading, Source URL, Date copied and the section text, plus a comment saying where it came from.
// Files that already hold text are left alone unless you pass --force. usage: node scripts/supplement/fill-files.mjs [extract.json] [--force] [--date=2026-10-24]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const args = process.argv.slice(2), json = args.find((a) => a.endsWith(".json")) ?? "/tmp/supplement-extract.json", force = args.includes("--force"), date = (args.find((a) => a.startsWith("--date=")) ?? "").slice(7) || new Date().toISOString().slice(0, 10);
const BIT = { "contract-act-1872": "e7571d39-11a7-4a2c-86e3-c515ae43e617", "ni-act-1881": "82bf1927-5e52-4aab-a876-50552c5952cd", "stamp-act-1899": "dc504bf4-89fc-4298-8ce6-edc6da5731d0", "cpc-1908": "fc9dad3f-97a9-4216-843b-934665693468",
  "hindu-marriage-act-1955": "526166d6-239d-4b6c-8999-c776179dea69", "limitation-act-1963": "8c2f3bc0-5daf-4d11-971f-ad5f9b78b74b", "specific-relief-act-1963": "aba411f8-4c8d-4c8e-af29-64d442ae80f0", "prevention-of-corruption-act-1988": "54dfd58e-7946-4041-b25d-5e0c85ba9aca" };
const INDIA_CODE_NAME = { "contract-act-1872": "a1872-9.pdf", "ni-act-1881": "a1881-26.pdf", "stamp-act-1899": "a1899-2_.pdf", "cpc-1908": "a1908-05.pdf", "hindu-marriage-act-1955": "a1955-25.pdf", "limitation-act-1963": "A1963-36.pdf", "specific-relief-act-1963": "A1963-47.pdf", "prevention-of-corruption-act-1988": "a1988-49.pdf" };
const NOTES = JSON.parse(fs.existsSync("scripts/supplement/fill-notes.json") ? fs.readFileSync("scripts/supplement/fill-notes.json", "utf8") : "{}");
const MONTHS = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
const created = (pdf) => { const m = /CreationDate:\s+\w{3}\s+(\w{3})\s+(\d+)\s+[\d:]+\s+(\d{4})/.exec(execFileSync("pdfinfo", [`content/supplement/pdfs/${pdf}.pdf`]).toString()); return m ? `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, "0")}` : "an unknown date"; };
let wrote = 0, kept = 0, skipped = 0;
for (const r of JSON.parse(fs.readFileSync(json, "utf8"))) {
  const path = `content/supplement/${r.file}`, old = fs.readFileSync(path, "utf8");
  if (!r.ok) { skipped++; console.log(`left empty: ${r.file} (${r.why})`); continue; }
  if (/=== SECTION TEXT[^\n]*\n\s*\S/.test(old) && !force) { kept++; continue; }
  const head = old.split(/^={3,}\s*SECTION TEXT.*$/m)[0].split("\n").filter((l) => !/^(Heading|Source URL|Date copied):/.test(l) && !/^# (Extracted|NOTE)/.test(l));
  const out = head.map((l) => (l.startsWith("Replaces existing text:") ? l : l)).filter((l, i, a) => !(l === "" && i === a.length - 1));
  const at = out.findIndex((l) => l.startsWith("Section:")), pdfDate = created(r.pdf);
  const extra = [`# Extracted ${date} from India Code's PDF ${INDIA_CODE_NAME[r.pdf]} (the PDF was created ${pdfDate}; amendments made after that date are not in it) by scripts/supplement/extract-sections.mjs.`,
    "# Every word was checked to be in the PDF. Printed amendment marks ([ ], * * *) are kept as printed; footnote numbers, footnotes and state amendments are left out."];
  for (const n of NOTES[r.file] ?? []) extra.push(`# NOTE: ${n}`);
  const lines = [...out.slice(0, at + 1), `Heading: ${r.heading}`, ...out.slice(at + 1), `Source URL: https://indiacode.gov.in/server/api/core/bitstreams/${BIT[r.pdf]}/content`, `Date copied: ${date}`];
  // comments go before the header block
  const firstHeader = lines.findIndex((l) => /^Act:/.test(l));
  const final = [...lines.slice(0, firstHeader), ...extra, ...lines.slice(firstHeader)].join("\n");
  fs.writeFileSync(path, `${final}\n=== SECTION TEXT (paste below this line) ===\n${r.text}\n`); wrote++;
}
console.log(`${wrote} files filled, ${kept} already had text (left alone), ${skipped} left empty.`);
