// The looser keyword search that answers when a sentence-style question finds nothing with every word required. PURE logic: no network, no database.
// A strict search needs ALL the words ("notice after cheque bounces" finds nothing if no section says "bounces"). The loose one drops filler words, requires none of the
// rest, and lets the database rank by how many of them a section contains. ONE place builds it for every keyword path (Acts, regulators, Supreme Court judgments, Ask).

/** Question filler that carries no legal meaning. The database already drops its own English stop-words; these are the extra ones a question is full of. */
export const FILLER = new Set(("a an the and or of to in on at by for with from into onto about as is are was were be been being am do does did done doing have has had having will would shall should can could may might must " +
  "what which who whom whose when where why how whether if then than that this these those there here it its i me my we us our you your he she they them their his her " +
  "not no yes any some such very much many more most less also just only even still too after before during under between over again once own same so because until while through against up down out off " +
  "tell explain please say says said want wants need needs know get gets got give gives find show kind type sort way thing things something someone anyone somebody " +
  "india indian law laws legal act section sections provision provisions rule rules").split(" "));

/** The words worth searching for in a question: letters and digits only, lower case, no filler, no repeats, at most `max`. */
export function looseTerms(q, max = 10) {
  const out = [];
  for (const w of String(q ?? "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length < 2 || FILLER.has(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

/** True when the reader asked for exact wording ("a quoted phrase") or used search operators: those are never loosened. */
export const wantsStrict = (q) => /["“”]/.test(String(q ?? "")) || /(^|\s)(-\S|OR(\s|$))/.test(String(q ?? ""));

/** A string for to_tsquery('english', $1): the terms joined with OR. "" when fewer than `min` terms are left (one word cannot be loosened further). */
export function looseTsQuery(q, { min = 2 } = {}) {
  if (wantsStrict(q)) return "";
  const t = looseTerms(q);
  return t.length >= min ? t.join(" | ") : "";
}

/** What the reader is told when these results match only some of their words. */
export const LOOSE_NOTE = "No result has all your words, so these match some of them, best matches first.";
/** When the strict search finds fewer than this many results for a question of three or more words, the loose one adds to them. */
export const LOOSE_BELOW = 5;
/** Same, when the strict search found some results but few. */
export const LOOSE_NOTE_FEW = "Few results have all your words; the rest match some of them, best matches first.";
/** A question with this many words (after the filler is dropped) is a sentence: it is ranked by how many of its words a section holds, not by the strict all-words match. */
export const SENTENCE_WORDS = 4;

/** The words to search with when the strict search should be loosened, or null when it should not. strictCount: how many results the strict search found. expand: adds the statutory synonyms of the question's words
 *  (searchBoost.mjs expandQuery). A question of SENTENCE_WORDS or more words is loosened even when the strict search found something (`sentence`), because all-words matches of a long question are usually odd ones. */
export function looseTermsFor(q, strictCount, { expand = (x) => x, sentence = true } = {}) {
  if (wantsStrict(q)) return null;
  const few = strictCount < LOOSE_BELOW, long = sentence && looseTerms(q).length >= SENTENCE_WORDS;
  if (!few && !long) return null;
  const terms = looseTerms(expand(q), 14);
  return terms.length >= (strictCount ? 3 : 2) ? terms : null;
}

/** A to_tsquery string that needs at least TWO of the terms: "a & b | a & c | b & c". Much cheaper than a plain OR over a large table (an OR of common words matches half the table), and still loose. With fewer than three terms it is the plain OR. */
export function atLeastTwo(terms, maxTerms = 8) {
  const t = terms.slice(0, maxTerms);
  if (t.length < 3) return t.join(" | ");
  const out = [];
  for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) out.push(`${t[i]} & ${t[j]}`);
  return out.join(" | ");
}
