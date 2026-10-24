// Runs the extraction for every fill-in file in content/supplement/ and writes the results to a JSON file for review (default: /tmp/supplement-extract.json). usage: node scripts/supplement/extract-all.mjs [out.json]
import fs from "node:fs";
import { cutSection, checkAgainstPdf } from "./extract-sections.mjs";
import { pdfLines } from "./pdf-text.mjs";
const PDF = { contract: "contract-act-1872", cpc: "cpc-1908", limitation: "limitation-act-1963", ni: "ni-act-1881", sra: "specific-relief-act-1963", pca: "prevention-of-corruption-act-1988", hma: "hindu-marriage-act-1955", stamp: "stamp-act-1899" };
const out = [], cache = {};
for (const f of fs.readdirSync("content/supplement").filter((x) => x.endsWith(".txt")).sort()) {
  const m = /^([a-z]+)-section-(\d+[A-Z]*)\.txt$/.exec(f); if (!m) continue;
  const file = `content/supplement/pdfs/${PDF[m[1]]}.pdf`, num = String(parseInt(m[2], 10)) + m[2].replace(/^\d+/, "");
  cache[file] ??= await pdfLines(file);
  const s = cutSection(cache[file], num);
  out.push({ file: f, pdf: PDF[m[1]], number: num, ...s, missingWord: s.ok ? checkAgainstPdf(file, s) : null });
}
fs.writeFileSync(process.argv[2] ?? "/tmp/supplement-extract.json", JSON.stringify(out, null, 1));
for (const r of out) console.log(`${r.file.padEnd(34)} ${r.ok ? `${r.heading.slice(0, 55).padEnd(56)} p${r.pages.join("-")} ${String(r.text.length).padStart(6)}ch ${r.missingWord ? "MISSING:" + r.missingWord : "words ok"}${r.duplicate ? " DUP" : ""} next: ${r.nextStart.slice(0, 34)}` : "NOT FOUND: " + r.why}`);
