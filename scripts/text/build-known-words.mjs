#!/usr/bin/env node
// Rebuilds src/config/known-words.json, the word list behind the "scan junk" check (src/lib/acts/scanJunk.mjs).
//   DATABASE_URL=<read-only Neon URL> node scripts/text/build-known-words.mjs [--dict /usr/share/dict/words]
// Method (read-only, deterministic; about 8 minutes). Every section of the Acts library (211,315 at the last build) is cleaned with the shared display layer (src/lib/text/clean.mjs cleanPlain, first 4,000
// characters) and split into lower-case words of four or more letters. For each word the build counts the sections it is in and the distinct Acts it is in. A word goes on the list when
//   (a) it is an English word: it, or its stem after removing a plural / -ed / -ing / -ly style ending, is in a general English word list (--dict, default /usr/share/dict/words) AND it occurs in at least 2 sections; or
//   (b) it is in at least 40 different Acts (legal and Indian terms that no general dictionary has: "panchayat", "ordinance", "tehsil").
// Scanning damage ("wherc", "dclivery") is neither: it is not English, and even when a damaged word repeats (the same Act is filed many times) it stays within a few Acts. Without (a), real technical words
// ("ginger", "differential", "polyvinyl") were reported as damage; the dictionary is only used here, at build time, and is not stored in the repo. Nothing is written to the database.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { wordsOf } from "../../src/lib/acts/scanJunk.mjs";

const dictPath = process.argv.includes("--dict") ? process.argv[process.argv.indexOf("--dict") + 1] : "/usr/share/dict/words";
const BATCHES = 36, MIN_SECTIONS_DICT = 2, MIN_ACTS_LEGAL = 40;
const url = process.env.DATABASE_URL?.trim();
if (!url) { console.error("Set DATABASE_URL to a read-only Neon URL."); process.exit(2); }
const D = new Set(fs.readFileSync(dictPath, "utf8").split("\n").map((w) => w.trim().toLowerCase()).filter(Boolean));
const ENDINGS = ["s", "es", "ed", "d", "ing", "ly", "er", "ers", "ness", "ment", "ments", "al", "ally"];
const inDict = (w) => {
  if (D.has(w)) return true;
  const c = [];
  if (w.endsWith("ies")) c.push(`${w.slice(0, -3)}y`);
  if (w.endsWith("ied")) c.push(`${w.slice(0, -3)}y`);
  for (const s of ENDINGS) if (w.endsWith(s) && w.length - s.length >= 3) { const b = w.slice(0, -s.length); c.push(b, `${b}e`); if (b.length > 3 && b.at(-1) === b.at(-2)) c.push(b.slice(0, -1)); }
  return c.some((x) => D.has(x));
};
const sql = neon(url), sec = new Map(), acts = new Map();
let rowsSeen = 0;
for (let k = 0; k < BATCHES; k++) {
  const rows = (await sql.transaction((tx) => [tx.query("SET LOCAL default_transaction_read_only = on"), tx.query("SELECT act_id, left(body, 4000) AS b FROM act_sections_v WHERE body IS NOT NULL AND mod(abs(hashtext(act_id || section_key)), $1) = $2", [BATCHES, k])]))[1];
  for (const r of rows) {
    rowsSeen++;
    for (const w of new Set(wordsOf(r.b).map((x) => x.toLowerCase()))) {
      sec.set(w, (sec.get(w) ?? 0) + 1);
      let a = acts.get(w); if (!a) acts.set(w, (a = new Set()));
      if (a.size < MIN_ACTS_LEGAL) a.add(r.act_id);
    }
  }
  console.log(`batch ${k + 1}/${BATCHES}: ${rowsSeen} sections, ${sec.size} distinct words`);
}
const words = [...sec].filter(([w, n]) => (n >= MIN_SECTIONS_DICT && inDict(w)) || acts.get(w).size >= MIN_ACTS_LEGAL).map(([w]) => w).sort();
const out = { built: new Date().toISOString().slice(0, 10), method: `all ${rowsSeen} sections, first 4000 characters, lower-case words of 4+ letters; kept when (an English word by ${dictPath} with its endings, in at least ${MIN_SECTIONS_DICT} sections) or (in at least ${MIN_ACTS_LEGAL} different Acts). Rebuild: DATABASE_URL=<read-only> node scripts/text/build-known-words.mjs`, words: words.join(" ") };
fs.writeFileSync(new URL("../../src/config/known-words.json", import.meta.url), JSON.stringify(out));
console.log(`${words.length} words from ${rowsSeen} sections`);
