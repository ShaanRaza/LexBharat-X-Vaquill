#!/usr/bin/env node
// Reads newline-delimited chunk rows on stdin (see export-act-text.sql, ordered by act_id) and writes, OUTSIDE the repo:
//   <OUT>/act=<actId>.json.gz   one file per act: act metadata + sections in reading order (raw text, status, flags, validated chapter)
//   <OUT>/_index.json           one summary row per act (counts per flag), for tooling
//   <OUT>/_report.json          totals: flag counts, file count, bytes, problems found while building
// usage: duckdb ... | node scripts/acts/build-act-text.mjs [OUT_DIR=../lexbharat-data/acts-text]
// The logic is src/lib/acts/reassemble.mjs (tested). Raw chunk text is stored unchanged apart from the two dataset-added header lines per chunk.
import { StringDecoder } from "node:string_decoder";
import { mkdirSync, rmSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { reassembleAct, countFlags } from "../../src/lib/acts/reassemble.mjs";

const OUT = path.resolve(process.argv[2] ?? "../lexbharat-data/acts-text");
const SNAPSHOT = "v2026.08";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const index = [], totals = {}, perJurisdiction = {};
let acts = 0, chunks = 0, unparsed = 0, noSectionAct = 0, garbledAct = 0, devanagariAct = 0, chapterPass = 0, chapterTotal = 0;
let cur = null, rows = [];

function flush() {
  if (!cur) return;
  const { sections, unparsed: bad } = reassembleAct(rows);
  unparsed += bad.length;
  const counts = countFlags(sections);
  const numbered = sections.filter((s) => s.kind === "s");
  const noNumbers = numbered.length > 0 && numbered.every((s) => s.flags.includes("no_section_number"));
  if (sections.length === 0 || noNumbers || numbered.length === 0) noSectionAct++;
  if (counts.garbled) garbledAct++;
  if (counts.devanagari) devanagariAct++;
  for (const s of numbered) { chapterTotal++; if (s.chapterCheck === "pass") chapterPass++; }
  countFlags(sections, totals);
  const jur = `${cur.jurisdiction}`; perJurisdiction[jur] = countFlags(sections, perJurisdiction[jur] ?? {});
  const doc = {
    schema: 1, actId: cur.actId, title: cur.title, jurisdiction: cur.jurisdiction, state: cur.state || null, actStatus: cur.actStatus, year: cur.year ?? null,
    sourceUrl: cur.sourceUrl || null, snapshot: SNAPSHOT, licence: "CC BY 4.0", chunkCount: rows.length,
    hasSectionNumbers: !noNumbers && numbered.length > 0, unparsedChunkIds: bad, sections,
  };
  writeFileSync(path.join(OUT, `act=${cur.actId}.json.gz`), gzipSync(JSON.stringify(doc), { level: 9 }));
  index.push({ actId: cur.actId, title: cur.title, jurisdiction: cur.jurisdiction, state: cur.state || null, sections: sections.length, hasSectionNumbers: doc.hasSectionNumbers, counts });
  acts++; rows = [];
}

// Split on "\n" only. (readline also breaks lines at U+2028/U+2029, which occur inside legal text and would cut a JSON row in two.)
const dec = new StringDecoder("utf8");
let carry = "";
function take(line) {
  if (!line) return;
  const r = JSON.parse(line);
  if (!cur || cur.actId !== r.actId) { flush(); cur = { actId: r.actId, title: r.title, jurisdiction: r.jurisdiction, state: r.state, actStatus: r.actStatus, year: r.year, sourceUrl: r.sourceUrl }; }
  rows.push({ actId: r.actId, chunkId: r.chunkId, sectionNumber: r.sectionNumber, text: r.text });
  chunks++;
}
for await (const buf of process.stdin) {
  carry += dec.write(buf);
  let i;
  while ((i = carry.indexOf("\n")) >= 0) { take(carry.slice(0, i)); carry = carry.slice(i + 1); }
}
carry += dec.end();
take(carry);
flush();

const files = readdirSync(OUT).filter((f) => f.endsWith(".json.gz"));
const bytes = files.reduce((n, f) => n + statSync(path.join(OUT, f)).size, 0);
const report = {
  snapshot: SNAPSHOT, scope: "Central and State/UT legislation only (regulator instruments excluded)", built: new Date().toISOString(),
  acts, chunksRead: chunks, unparsedChunks: unparsed, files: files.length, bytesGzipped: bytes,
  actsWithNoSectionNumbers: noSectionAct, actsWithGarbledSection: garbledAct, actsWithDevanagari: devanagariAct,
  chapterLabels: { checked: chapterTotal, passed: chapterPass, hidden: chapterTotal - chapterPass },
  flagCounts: totals, byJurisdiction: perJurisdiction,
};
writeFileSync(path.join(OUT, "_index.json"), JSON.stringify(index));
writeFileSync(path.join(OUT, "_report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
