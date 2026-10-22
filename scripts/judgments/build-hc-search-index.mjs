#!/usr/bin/env node
// Builds the compact High Court search index from the exported case pages (scripts/judgments/export-judgments-hc.sh).
// usage: node scripts/judgments/build-hc-search-index.mjs [DATA_DIR=../lexbharat-data/judgments-hc] [--years 2020-2025] [--courts a,b]
//
// What each case contributes: the WORDS of its petitioner/respondent (or title when parties were not extracted), its CASE NUMBER ("#933/2024") and the YEAR in it ("@2024"), as recorded. No text, no snippets.
// Layout (written next to the case pages, served the same way: JUDGMENTS_DATA_DIR or JUDGMENTS_DATA_URL):
//   <DATA_DIR>/search/meta.json            { version, courts[], segments[[year, courtIdx, startId, count]], shards, docs, built }
//   <DATA_DIR>/search/shard=NNN.json       { "<word or #number/year>": [firstId, delta, delta, ...] }   ascending ids, delta encoded
// A document id is year-major: ids run newest year first, then court, then the case's position in its court-year list, so the smallest ids are the newest cases
// and "id -> court, year, page, row" is a binary search over `segments`. No node dependency: JSON in, JSON out (gzip copies are made by gzip-for-upload.sh).
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, createReadStream } from "node:fs";
import { once } from "node:events";
import { createInterface } from "node:readline";
import path from "node:path";
import { SHARDS, caseKeys, caseYears, shardOf, tokenize } from "../../src/lib/judgments/hcSearchCore.mjs";

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DATA = path.resolve(args.find((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1].startsWith("--"))) ?? "../lexbharat-data/judgments-hc");
const yrs = opt("--years", ""), [YF, YT] = yrs ? yrs.split("-").map(Number) : [1900, 2026], only = opt("--courts", "");
const OUT = path.join(DATA, "search"), TMP = path.join(DATA, "search-tmp");
if (!existsSync(path.join(DATA, "_manifest"))) { console.error(`No export found in ${DATA}. Run scripts/judgments/export-judgments-hc.sh first.`); process.exit(1); }

// ---- segments: (year desc, court) in id order
const courts = readdirSync(path.join(DATA, "_manifest")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((c) => !only || only.split(",").includes(c)).sort();
const segs = [];
for (const [ci, court] of courts.entries()) for (const m of JSON.parse(readFileSync(path.join(DATA, "_manifest", `${court}.json`), "utf8"))) if (m.year >= YF && m.year <= YT) segs.push({ year: m.year, ci, court, count: m.cases, pages: m.pages });
segs.sort((a, b) => b.year - a.year || a.ci - b.ci);
let next = 0; for (const s of segs) { s.start = next; next += s.count; }
console.error(`${courts.length} courts, ${segs.length} court-years, ${next.toLocaleString("en-IN")} cases`);

// ---- phase 1: stream "word<TAB>id" lines into per-shard temp files (ids ascend as we go)
rmSync(TMP, { recursive: true, force: true }); rmSync(OUT, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(OUT, { recursive: true });
const sinks = Array.from({ length: SHARDS }, (_, i) => ({ s: createWriteStream(path.join(TMP, `${i}.tsv`), { highWaterMark: 1 << 20 }), buf: [] }));
const flush = (k) => { const sk = sinks[k]; if (sk.buf.length) { sk.s.write(sk.buf.join("")); sk.buf = []; } };
let postings = 0, docs = 0, t0 = Date.now();
for (const sg of segs) {
  let ord = 0;
  for (let p = 1; p <= sg.pages; p++) {
    const f = path.join(DATA, `court=${sg.court}`, `year=${sg.year}`, `page=${p}`, "data_0.json");
    const rows = JSON.parse(readFileSync(f, "utf8"));
    for (const c of rows) {
      const id = sg.start + ord++;
      const words = tokenize(c.petitioner && c.respondent ? `${c.petitioner} ${c.respondent}` : (c.title ?? "").replace(/^\S*\d\/\d{4}\s+of\s+/i, ""));
      for (const t of [...words, ...caseKeys(c.caseNumber, c.title), ...caseYears(c.caseNumber, c.title)]) { const sk = sinks[shardOf(t)]; sk.buf.push(`${t}\t${id}\n`); postings++; }
      docs++;
    }
    for (let k = 0; k < SHARDS; k++) if (sinks[k].buf.length > 4000) flush(k);
  }
  if (ord !== sg.count) console.error(`warning: ${sg.court} ${sg.year}: pages hold ${ord} cases, manifest says ${sg.count}`);
  if (sg.ci === courts.length - 1 && sg.year % 5 === 0) console.error(`  ${sg.year} done, ${docs.toLocaleString("en-IN")} cases, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
for (let k = 0; k < SHARDS; k++) { flush(k); sinks[k].s.end(); await once(sinks[k].s, "finish"); }
console.error(`phase 1: ${docs.toLocaleString("en-IN")} cases, ${postings.toLocaleString("en-IN")} postings, ${((Date.now() - t0) / 1000).toFixed(0)}s`);

// ---- phase 2: per shard, group by word and delta-encode
let bytes = 0, words = 0, biggest = 0;
for (let k = 0; k < SHARDS; k++) {
  const m = new Map();
  for await (const line of createInterface({ input: createReadStream(path.join(TMP, `${k}.tsv`)), crlfDelay: Infinity })) {
    const tab = line.indexOf("\t"); if (tab < 0) continue;
    const w = line.slice(0, tab), id = Number(line.slice(tab + 1)), a = m.get(w);
    if (!a) m.set(w, [id]); else if (a[a.length - 1] !== id) a.push(id);
  }
  const o = {};
  for (const [w, ids] of [...m].sort((a, b) => (a[0] < b[0] ? -1 : 1))) { const d = [ids[0]]; for (let i = 1; i < ids.length; i++) d.push(ids[i] - ids[i - 1]); o[w] = d; }
  const json = JSON.stringify(o); writeFileSync(path.join(OUT, `shard=${String(k).padStart(3, "0")}.json`), json);
  bytes += json.length; words += m.size; biggest = Math.max(biggest, json.length);
}
rmSync(TMP, { recursive: true, force: true });
writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ version: 1, built: new Date().toISOString().slice(0, 10), shards: SHARDS, docs, postings, words, courts, segments: segs.map((s) => [s.year, s.ci, s.start, s.count]),
  scope: "party names (petitioner, respondent, or title when parties were not extracted) and case numbers, as recorded. No judgment text." }));
console.error(`phase 2: ${words.toLocaleString("en-IN")} distinct words, ${(bytes / 1e6).toFixed(0)} MB of shards (largest ${(biggest / 1e6).toFixed(1)} MB), ${((Date.now() - t0) / 1000).toFixed(0)}s total`);
