// "Scan junk": a section whose text came out of the scan with many broken words ("Wherc h c landlord obtains dclivery of possession"). PURE logic. It changes one thing only, the label shown for a section
// that is stored as "complete": that label becomes "Possibly incomplete". It never hides or removes a section, in chat, search or the Library, and the stored data is not touched.
// Rule (looked at by eye on flagged sections, see docs): of the lowercase words of four or more letters, at least 20% are not in the known-word list AND at least 6 are not in it.
// Capitalised words are not counted at all: names, places and Acts in lists are not scan damage. The list: src/config/known-words.json, rebuilt by scripts/text/build-known-words.mjs.
import { cleanPlain } from "../text/clean.mjs";
import list from "../../config/known-words.json" with { type: "json" };

export const MIN_TOKENS = 12, MIN_ODD = 6, MIN_SHARE = 0.2, SAMPLE_CHARS = 4000;
const KNOWN = new Set(String(list.words).split(" "));   // one string of words separated by spaces: smaller than a JSON array

/** The words of four or more letters of a section, after the shared cleaning. */
export const wordsOf = (text) => cleanPlain(String(text ?? "").slice(0, SAMPLE_CHARS)).match(/[A-Za-z]{4,}/g) ?? [];

/** { tokens, lower, odd, share } for a text, or null when it is too short to judge (fewer than 12 words of four letters or more). */
export function scanJunkScore(text, known = KNOWN) {
  const t = wordsOf(text);
  if (t.length < MIN_TOKENS) return null;
  const low = t.filter((w) => /^[a-z]/.test(w)), odd = low.filter((w) => !known.has(w));
  return { tokens: t.length, lower: low.length, odd: odd.length, share: low.length ? odd.length / low.length : 0 };
}

export function looksLikeScanJunk(text, known = KNOWN) {
  const s = scanJunkScore(text, known);
  return !!s && s.odd >= MIN_ODD && s.share >= MIN_SHARE;
}
