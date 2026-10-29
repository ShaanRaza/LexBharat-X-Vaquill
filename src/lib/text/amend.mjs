// Amendment markers in the text of a law. PURE logic. India Code text carries "4[within thirty days]" (words inserted or substituted by an amendment; footnote 4 says how), a stray "[1] [( 1 )]",
// spaced brackets "( b )" and, from the copying, a few joined words ("thecheque"). This turns one paragraph into parts the screen can show cleanly: text, and a footnote mark where the bracketed words end.
const OPEN = "\uE100", CLOSE = "\uE101";   // not the search-highlight pair (\uE000, \uE001)   // private-use markers for a footnote mark while the brackets are peeled, innermost first

/** The words that appear on their own in these paragraphs (lower case, 4+ letters): the vocabulary used to un-join "thecheque". */
export const vocabOf = (paragraphs) => new Set(paragraphs.join(" ").toLowerCase().match(/(?<![a-z])[a-z]{4,}(?![a-z])/g) ?? []);

/** [{ t: "text", v } | { t: "mark", n }]. A numbered bracket "4[words]" loses its number and brackets and a mark follows the words; nested brackets work; an opener whose closing bracket is in another paragraph keeps its mark at the opener,
 *  and a stray "]" is dropped. Other brackets ("[XXX]") are text. "the" + a word is split ("thecheque") only when that word also appears on its own in the same section. */
export function amendParts(text, vocab = new Set()) {
  let t = String(text).replace(/(\d)\s?\[(st|nd|rd|th)\]/gi, "$1$2").replace(/\[(\d{1,2})\]\s*\[(\(\s*[A-Za-z0-9]{1,4}\s*\))\]/g, "$1[$2]").replace(/\(\s+([A-Za-z0-9]{1,4})\s+\)/g, "($1)");   // "[1] [( 1 )]": footnote 1 marks the bracketed "(1)"
  t = t.replace(/\[(\d{1,2})\s?\]\[/g, "$1[").replace(/\[(\d{1,2})\s?\]/g, (_, n) => `${OPEN}${n}${CLOSE}`);   // "[1][words]" is "1[words]"; a footnote reference on its own: "...Legislature.[1] [2 ]", "of the [1]Indian Penal Code"
  t = t.replace(/\b(the)([a-z]{4,})\b/g, (m, a, b) => (vocab.has(b) ? `${a} ${b}` : m));   // only "the": other prefixes would split real words (another, income, offence)
  const mark = (n) => `${OPEN}${n}${CLOSE}`, stack = []; let out = "";
  for (let i = 0; i < t.length; ) {
    const ch = t[i], m = /^(\d{1,2}) ?\[/.exec(t.slice(i, i + 5));
    if (m && !/[A-Za-z0-9]/.test(t[i - 1] ?? " ")) { stack.push({ n: Number(m[1]), at: out.length }); i += m[0].length; continue; }   // "4[" opens a numbered bracket
    if (ch === "[") { stack.push({ n: null }); out += ch; i++; continue; }
    if (ch === "]") { const o = stack.pop(); if (!o) { i++; continue; } if (o.n === null) out += ch; else out += mark(o.n); i++; continue; }   // a stray "]" is dropped
    out += ch; i++;
  }
  for (const o of stack.filter((x) => x.n !== null).reverse()) out = out.slice(0, o.at) + mark(o.n) + out.slice(o.at);   // opener never closed here: its mark stays where it opened
  const parts = [];
  out.split(new RegExp(`${OPEN}(\\d+)${CLOSE}`)).forEach((piece, i) => { if (i % 2 === 0) { if (piece) parts.push({ t: "text", v: piece }); } else parts.push({ t: "mark", n: Number(piece) }); });
  return parts;
}
