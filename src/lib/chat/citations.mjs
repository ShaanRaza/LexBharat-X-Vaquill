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


/** Which retrieved source does "Section <number> of <Act name>" refer to? `named` is the Act name as written (or an alias like "NI Act"), undefined when none was written. Returns the source or null.
 *  A source matches only when it has that section number AND (the named Act matches its title, or no Act is named and exactly one source has that number). Never a guess. */
export function resolveMention(number, named, sources) {
  const base = String(number).toUpperCase(), words_ = named ? words(ALIASES[named.toLowerCase()] ?? named) : [];
  const cands = sources.filter((s) => s.number && String(s.number).toUpperCase() === base);
  if (words_.length) return cands.find((s) => { const t = new Set(words(s.actTitle)); return words_.every((w) => t.has(w)); }) ?? cands.find((s) => words_.filter((w) => words(s.actTitle).includes(w)).length >= Math.max(1, words_.length - 1)) ?? null;
  return cands.length === 1 ? cands[0] : null;
}

/** Every "Section N of <Act>" mention in a text where an Act is NAMED, with the retrieved source it matches (or null when none does): [{ text, number, act, source }]. Used to flag references to law that was not retrieved. */
export function findStatuteMentions(text, sources) {
  const out = [];
  for (const m of text.matchAll(MENTION)) if (m[4]) out.push({ text: m[0], number: m[2] + (m[3] ?? ""), act: m[4], source: resolveMention(m[2], m[4], sources) });
  return out;
}

/** Splits answer text into pieces: { type:"text", text } | { type:"cite", n } | { type:"statute", text, n }.
 *  - "[3]" becomes a cite piece when 3 is a retrieved source (others are dropped).
 *  - "Section 138 of the Negotiable Instruments Act, 1881" becomes a statute piece linked to source n when a retrieved source has that section number AND (the Act name in the text matches
 *    that source's Act, or no Act is named and exactly one retrieved source has that number). Nothing is linked on a guess.
 *  Each Act is linked only on its FIRST mention in the answer (later mentions stay plain text); the [n] chips are never limited.
 *  sources: [{ n, number, actTitle, actId? }] */
export function linkSegments(text, sources) {
  const marks = [];
  for (const m of text.matchAll(CITE_RE)) marks.push({ start: m.index, end: m.index + m[0].length, kind: "cite", nums: m[1].split(/[,;]/).map((x) => Number(x.trim())) });
  for (const m of text.matchAll(MENTION)) {
    const pick = resolveMention(m[2], m[4], sources);
    if (pick) marks.push({ start: m.index, end: m.index + m[0].length, kind: "statute", n: pick.n });
  }
  marks.sort((a, b) => a.start - b.start || b.end - a.end);
  const valid = new Set(sources.map((s) => s.n)), out = [], linkedActs = new Set(); let pos = 0;
  for (const mk of marks) {
    if (mk.start < pos) continue;   // overlapping: keep the first
    if (mk.start > pos) out.push({ type: "text", text: text.slice(pos, mk.start) });
    if (mk.kind === "cite") for (const n of mk.nums) { if (valid.has(n)) out.push({ type: "cite", n }); }
    else {
      const src = sources.find((x) => x.n === mk.n), act = src?.actId ?? src?.actTitle ?? String(mk.n);
      if (linkedActs.has(act)) out.push({ type: "text", text: text.slice(mk.start, mk.end) });   // this Act was already linked earlier in the answer
      else { linkedActs.add(act); out.push({ type: "statute", text: text.slice(mk.start, mk.end), n: mk.n }); }
    }
    pos = mk.end;
  }
  if (pos < text.length) out.push({ type: "text", text: text.slice(pos) });
  return out;
}

/** Safety net for an answer whose lines name "Section N of <Act>" without the [n] chip: adds " [n]" to the end of such a line when the section named is one of the retrieved sources (the mention itself says which).
 *  Lines that already carry a citation, and mentions that match no source, are left alone. */
export function ensureCitations(text, sources) {
  return text.split("\n").map((line) => {
    if (!line.trim() || CITE_RE.test(line)) { CITE_RE.lastIndex = 0; return line; }
    CITE_RE.lastIndex = 0;
    const m = findStatuteMentions(line, sources).find((x) => x.source);
    return m ? `${line.replace(/\s+$/, "")} [${m.source.n}]` : line;
  }).join("\n");
}
