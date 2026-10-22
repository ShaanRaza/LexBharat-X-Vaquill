// Shared by the High Court search index builder (scripts/judgments/build-hc-search-index.mjs) and the runtime search (src/lib/judgments/hcSearch.ts), so both sides
// tokenise, hash and read case numbers in exactly the same way. Pure string code: no dependencies.
//
// What is indexed: the PARTY NAMES (petitioner and respondent, or the title when parties were not extracted) and the CASE NUMBER, as recorded in the dataset.
// Never judgment text. Words are matched whole (word boundary); a typed word with no exact match falls back to words that start with it.
export const SHARDS = 512;

const STOP = new Set((
  "of the and vs v versus ors anr anrs others other another through its by to in on for at as sri shri smt mr mrs ms dr m s no nos " +
  // generic case-type words: they describe the kind of case, not a party, and would add millions of useless postings
  "writ petition petitions civil criminal appeal appeals application applications bail revision matter matters suit suits misc miscellaneous special leave first second " +
  "original reference review contempt cause title crl cri cr ca wp sa fa slp oa mca cm"
).split(" "));

/** Lower-case, accent-free, alphabetic words of 2+ letters, without stop words, each word once. */
export function tokenize(text) {
  if (!text) return [];
  const out = new Set();
  for (const w of text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/)) if (w.length >= 2 && w.length <= 30 && !STOP.has(w)) out.add(w);
  return [...out];
}

/** FNV-1a, 32 bit. */
export function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** Words that share their first three letters share a shard, so a typed prefix is answered from one file. Case-number keys ("#933/2024") hash whole. */
export const shardOf = (token) => fnv(token.startsWith("#") ? token : token.slice(0, 3)) % SHARDS;

// number / year, where neither side is part of a longer digit run: in "A482/42016/2023" the number is 42016, not 482/4201 and not 6/2023
const NUM = /(?<!\d)(\d{1,7})\s*(?:\/|of)\s*(\d{4})(?!\d)/gi;
/** Case-number keys: "933 of 2024", "933/2024", "WP/933/2024" all give "#933/2024". The recorded case number and any reference in the title are both read. */
export function caseKeys(...texts) {
  const out = new Set();
  for (const t of texts) { if (!t) continue; NUM.lastIndex = 0; let m; while ((m = NUM.exec(t))) { const y = Number(m[2]); if (y >= 1800 && y <= 2030) out.add(`#${Number(m[1])}/${y}`); } }
  return [...out];
}

/** What to look up for a typed query: case-number keys found in it, and the remaining words. */
export function planQuery(q) {
  const keys = caseKeys(q);
  const words = tokenize(q.replace(NUM, " "));
  return { keys, words };
}
