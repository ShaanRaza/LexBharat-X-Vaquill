// Amendment markers in the text of a law. PURE logic. India Code text carries "4[within thirty days]" (words inserted or substituted by an amendment; footnote 4 says how), a stray "[1] [( 1 )]",
// spaced brackets "( b )" and, from the copying, a few joined words ("thecheque"). This turns one paragraph into parts the screen can show cleanly: text, and a footnote mark where the bracketed words end.
const OPEN = "\uE000", CLOSE = "\uE001";   // private-use markers for a footnote mark while the brackets are peeled, innermost first

/** The words that appear on their own in these paragraphs (lower case, 4+ letters): the vocabulary used to un-join "thecheque". */
export const vocabOf = (paragraphs) => new Set(paragraphs.join(" ").toLowerCase().match(/(?<![a-z])[a-z]{4,}(?![a-z])/g) ?? []);

/** [{ t: "text", v } | { t: "mark", n }]. Brackets and their number are dropped from the text; a mark follows the words they enclosed. "the" + a word is split ("thecheque") only when that word also appears on its own in the same section. */
export function amendParts(text, vocab = new Set()) {
  let t = String(text).replace(/\[(\d{1,2})\]\s*\[/g, "$1[").replace(/\(\s+([A-Za-z0-9]{1,4})\s+\)/g, "($1)");
  t = t.replace(/\b(the)([a-z]{4,})\b/g, (m, a, b) => (vocab.has(b) ? `${a} ${b}` : m));   // only "the": other prefixes would split real words (another, income, offence)
  for (let i = 0; i < 8; i++) { const next = t.replace(/(?<![A-Za-z0-9])(\d{1,2})\s?\[([^\[\]]+)\]/g, (_, n, inner) => `${inner}${OPEN}${n}${CLOSE}`); if (next === t) break; t = next; }
  const parts = [];
  t.split(new RegExp(`${OPEN}(\\d+)${CLOSE}`)).forEach((piece, i) => { if (i % 2 === 0) { if (piece) parts.push({ t: "text", v: piece }); } else parts.push({ t: "mark", n: Number(piece) }); });
  return parts;
}
