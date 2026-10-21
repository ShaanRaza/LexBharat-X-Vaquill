#!/usr/bin/env node
// Extracts the full bench and the case number from the opening text of every Supreme Court report and merges them into src/data/judgments/sc/<year>.json.
// usage: node scripts/judgments/extract-sc-fields.mjs <opening.ndjson> <judges.ndjson>
//   opening.ndjson  {caseId, text}    first ~3000 characters of the English document start (made by export-sc-fields.sh)
//   judges.ndjson   {caseId, judges}  the dataset's own `judges` field (the authoring judge): spells names and must be on the extracted bench
// The parsing rules live in src/lib/judgments/extract.mjs (shared with the unit tests). Fields are written ONLY when the text matches cleanly; otherwise absent.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { buildVocabulary, nameKey, parseCaseNumber, printedBench, tidyName, verifyBench } from "../../src/lib/judgments/extract.mjs";

const lines = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const opening = lines(process.argv[2]);
const judges = new Map(lines(process.argv[3]).map((j) => [j.caseId, j.judges || []]));

// dataset judge list -> known spellings (a name seen at least twice), canonical = the most common spelling
const spell = new Map();
for (const js of judges.values()) for (const raw of js) { const n = raw.replace(/\s+/g, " ").trim(), k = nameKey(n); if (!n) continue; if (!spell.has(k)) spell.set(k, new Map()); const c = spell.get(k); c.set(n, (c.get(n) ?? 0) + 1); }
const known = new Map([...spell].filter(([k, c]) => k.length >= 4 && [...c.values()].reduce((a, b) => a + b, 0) >= 2).map(([k, c]) => [k, tidyName([...c].sort((a, b) => b[1] - a[1])[0][0])]));

const printed = new Map(opening.map((r) => [r.caseId, printedBench(r.text, r.caseId)]));
const vocab = buildVocabulary([...printed.values()].map((p) => p?.names), known);
const bench = new Map(), caseNo = new Map(), stats = { blocks: 0, rejected_by_vocabulary: 0 };
for (const r of opening) {
  const p = printed.get(r.caseId);
  if (p) { stats.blocks++; const b = verifyBench(p.names, vocab, judges.get(r.caseId)); if (b) bench.set(r.caseId, b); else stats.rejected_by_vocabulary++; }
  const c = parseCaseNumber(r.text, Number(r.caseId.slice(0, 4)) + 1, r.caseId);   // +1: the report year can trail the decision year
  if (c) caseNo.set(r.caseId, c);
}

let total = 0;
for (const f of readdirSync("src/data/judgments/sc").filter((x) => x.endsWith(".json")).sort()) {
  const path = `src/data/judgments/sc/${f}`, rows = JSON.parse(readFileSync(path, "utf8"));
  for (const c of rows) { delete c.benchExtracted; delete c.caseNumberExtracted; if (bench.has(c.caseId)) c.benchExtracted = bench.get(c.caseId); if (caseNo.has(c.caseId)) c.caseNumberExtracted = caseNo.get(c.caseId); total++; }
  writeFileSync(path, "[\n" + rows.map((c) => "\t" + JSON.stringify(c)).join(",\n") + "\n]\n");
}
console.error(JSON.stringify({ cases: total, english_openings: opening.length, bench_blocks_found: stats.blocks, bench_extracted: bench.size, rejected_by_vocabulary: stats.rejected_by_vocabulary, case_number_extracted: caseNo.size, vocabulary_names: vocab.size }));
