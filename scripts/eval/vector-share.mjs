// Q: in the evaluation runs, what share of Ask retrievals used the vector search and what share fell back to keyword search?
// The evaluation server caches every query vector it got from Voyage (docs/eval/.cache/embed.json) and caches nothing when Voyage failed. So a search query that was meant for the vector search (not a section lookup, not a quoted phrase,
// not Hindi) and has NO cached vector can only have been answered by keyword search. A cached vector shows Voyage answered that query at some time (maybe in an earlier run), which is an upper bound on "used vectors" for runs before the fallback was logged.
// Rows written after the logging change also carry `meaning` (used / fellBack per retrieval) and are counted exactly. Run: node scripts/eval/vector-share.mjs [run names...]
import fs from "node:fs";
import { cacheKey } from "../../src/lib/acts/semantic.mjs";
import { expandQuery } from "../../src/lib/acts/searchBoost.mjs";
import { parseSectionLookup, hasDevanagari } from "../../src/lib/acts/searchQuery.mjs";
const synonyms = JSON.parse(fs.readFileSync(new URL("../../src/config/search-synonyms.json", import.meta.url), "utf8"));
const cache = JSON.parse(fs.readFileSync(new URL("../../docs/eval/.cache/embed.json", import.meta.url), "utf8"));
const runs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(new URL("../../docs/eval/runs/", import.meta.url)).filter((f) => /^(baseline|fix-|hard-|daily|base|cur)/.test(f)).map((f) => f.replace(/\.json$/, ""));
let tot = { runs: 0, questions: 0, queries: 0, eligible: 0, withVector: 0, fellBack: 0, exactMeaning: 0, exactFell: 0 };
for (const name of runs) {
  const f = new URL(`../../docs/eval/runs/${name}.json`, import.meta.url); if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, "utf8")), rows = Array.isArray(d) ? d : d.rows ?? [];
  let elig = 0, have = 0, miss = 0, em = 0, ef = 0;
  for (const r of rows) {
    if (r.meaning) { em += r.meaning.used || 0; ef += r.meaning.fellBack || 0; }
    for (const q of r.queries ?? []) {
      if (parseSectionLookup(q) || hasDevanagari(q) || /"[^"]{2,}"/.test(q)) continue;
      elig++; (cache[`256|${cacheKey(expandQuery(q, synonyms.rules).text)}`] || cache[`256|${cacheKey(q)}`] ? have++ : miss++);   // the synonym expansion came later than the oldest runs: those embedded the query as typed
    }
  }
  console.log(`${name.padEnd(14)} questions ${String(rows.length).padStart(3)}  vector-eligible queries ${String(elig).padStart(4)}  with a vector ${String(have).padStart(4)}  without ${String(miss).padStart(3)}${em + ef ? `  | logged: used ${em}, fell back ${ef}` : ""}`);
  tot.runs++; tot.questions += rows.length; tot.eligible += elig; tot.withVector += have; tot.fellBack += miss; tot.exactMeaning += em; tot.exactFell += ef;
}
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : "n/a");
console.log(`\nTOTAL ${tot.runs} runs, ${tot.questions} questions, ${tot.eligible} vector-eligible queries: with a vector ${tot.withVector} (${pct(tot.withVector, tot.eligible)}), certainly fell back ${tot.fellBack} (${pct(tot.fellBack, tot.eligible)})${tot.exactMeaning + tot.exactFell ? `; logged exact: used ${tot.exactMeaning}, fell back ${tot.exactFell}` : ""}`);
