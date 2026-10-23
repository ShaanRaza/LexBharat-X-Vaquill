// Citations in a chat answer. PURE logic: no database, no network, no styling. The model is told to cite sources as [1], [2]...; this module checks those numbers against the sources that
// were actually retrieved, removes any that are not, and turns the text into pieces the UI can show as chips and links.

const CITE_RE = /\[(\d{1,2}(?:\s*[,;]\s*\d{1,2})*)\]/g;   // [1]  [1, 2]  [1;2]

/** Numbers cited in the text, in order of first use. */
export function citedNumbers(text) {
  const seen = []; for (const m of text.matchAll(CITE_RE)) for (const n of m[1].split(/[,;]/).map((x) => Number(x.trim()))) if (!seen.includes(n)) seen.push(n);
  return seen;
}

/** Removes citations to numbers outside 1..max (the model cannot cite what was not retrieved). Returns { text, invalid: [numbers removed] }. [1, 9] keeps the valid 1. */
export function sanitizeCitations(text, max) {
  const invalid = [];
  const out = text.replace(CITE_RE, (_, list) => {
    const nums = list.split(/[,;]/).map((x) => Number(x.trim())), good = nums.filter((n) => n >= 1 && n <= max);
    for (const n of nums) if (!(n >= 1 && n <= max) && !invalid.includes(n)) invalid.push(n);
    return good.length ? `[${good.join(", ")}]` : "";
  }).replace(/[ \t]+([.,;:!?])/g, "$1").replace(/ {2,}/g, " ");
  return { text: out, invalid };
}

// ---- statute names -> section links
const ALIASES = { "ni act": "negotiable instruments", ipc: "indian penal code", crpc: "code of criminal procedure", cpc: "code of civil procedure", bns: "bharatiya nyaya sanhita", bnss: "bharatiya nagarik suraksha sanhita", bsa: "bharatiya sakshya adhiniyam" };
const FILLER = new Set(["the", "of", "and", "act", "code", "in", "for", "to", "a", "an"]);
const words = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !FILLER.has(w) && !/^\d{4}$/.test(w));
const MENTION = /\b(Sections?|Sec\.|s\.)\s+(\d{1,4}[A-Z]{0,2})((?:\([a-z0-9]+\))*)(?:\s+(?:of|under)\s+(?:the\s+)?((?:Code of (?:Civil|Criminal) Procedure(?:,?\s+(?:1[89]|20)\d\d)?)|(?:[A-Z][\w&'’.-]*(?:\s+(?:of|and|the|for|in|[A-Z][\w&'’.-]*))*?\s+(?:Act|Code|Sanhita|Adhiniyam)(?:,?\s+(?:1[89]|20)\d\d)?)|NI Act|IPC|CrPC|CPC|BNS|BNSS|BSA))?/g;

/** Splits answer text into pieces: { type:"text", text } | { type:"cite", n } | { type:"statute", text, n }.
 *  - "[3]" becomes a cite piece when 3 is a retrieved source (others are dropped).
 *  - "Section 138 of the Negotiable Instruments Act, 1881" becomes a statute piece linked to source n when a retrieved source has that section number AND (the Act name in the text matches
 *    that source's Act, or no Act is named and exactly one retrieved source has that number). Nothing is linked on a guess.
 *  sources: [{ n, number, actTitle }] */
export function linkSegments(text, sources) {
  const marks = [];
  for (const m of text.matchAll(CITE_RE)) marks.push({ start: m.index, end: m.index + m[0].length, kind: "cite", nums: m[1].split(/[,;]/).map((x) => Number(x.trim())) });
  for (const m of text.matchAll(MENTION)) {
    const base = m[2].toUpperCase(), named = m[4] ? words(ALIASES[m[4].toLowerCase()] ?? m[4]) : [];
    const cands = sources.filter((s) => s.number && String(s.number).toUpperCase() === base);
    let pick = null;
    if (named.length) pick = cands.find((s) => { const t = new Set(words(s.actTitle)); return named.every((w) => t.has(w)); }) ?? cands.find((s) => named.filter((w) => words(s.actTitle).includes(w)).length >= Math.max(1, named.length - 1)) ?? null;
    else if (cands.length === 1) pick = cands[0];
    if (pick) marks.push({ start: m.index, end: m.index + m[0].length, kind: "statute", n: pick.n });
  }
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const valid = new Set(sources.map((s) => s.n)), out = []; let pos = 0;
  for (const mk of marks) {
    if (mk.start < pos) continue;   // overlapping: keep the first
    if (mk.start > pos) out.push({ type: "text", text: text.slice(pos, mk.start) });
    if (mk.kind === "cite") for (const n of mk.nums) { if (valid.has(n)) out.push({ type: "cite", n }); }
    else out.push({ type: "statute", text: text.slice(mk.start, mk.end), n: mk.n });
    pos = mk.end;
  }
  if (pos < text.length) out.push({ type: "text", text: text.slice(pos) });
  return out;
}
