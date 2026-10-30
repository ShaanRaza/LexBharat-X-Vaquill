// Shared cleaner for raw extraction marks in stored legal text (Acts, regulator instruments, judgments). PURE logic: no database, no files, no styling.
//
// STATUS: written and tested, NOT yet used by the on-screen path or by any stored-text job. The measuring script (scripts/text/measure-marks.mjs)
// is its first user. Nothing here ever writes anywhere; `cleanMarks` returns a new string and the caller decides what to do with it.
//
// Two lists, on purpose:
//   CLEAN_RULES      marks that are never law: HTML, picture placeholders, markdown footnote refs, footnote-style amendment lines ("1. Subs. by Act 12 of 2013, s. 4 ...")
//                    and bracketed amendment notes ("[Subs. by ...]"). These are removed.
//   AMBIGUOUS_RULES  things that look like marks but may be law or status information (a proviso in brackets, "[Repealed]", "1[" amendment brackets, "w.e.f." notes,
//                    "Omitted by" lines that may be a real status line). They are only COUNTED by findMarks; cleanMarks never touches them until the owner approves a kind.
// Never removed: "[Repealed]" / "[omitted]" style status text, paragraph breaks, numbering such as (1) (a) (i), Devanagari or any other script, "* * *" printed omission marks.

const BLOCK_TAGS = "p|div|tr|li|ul|ol|table|thead|tbody|h[1-6]|blockquote|section|article|pre|center|hr|br";
const INLINE_TAGS = "span|b|i|u|em|strong|sup|sub|a|font|small|big|tt|td|th|img|head|body|html";
const KNOWN_TAG = `(?:${BLOCK_TAGS}|${INLINE_TAGS})`;
const TAG_RE = new RegExp(`</?${KNOWN_TAG}(?:\\s[^<>]*)?/?>`, "gi");
// a line break where a block ends: </p> </div> </li> ... and <br> <hr>; an opening block tag adds nothing
const BLOCK_TAG_RE = new RegExp(`^(?:</(?:${BLOCK_TAGS})\\b|<(?:br|hr)\\b)`, "i");

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", sect: "§", para: "¶", copy: "©", deg: "°", times: "×" };
const ENTITY_RE = /&(?:#(\d{1,6})|#[xX]([0-9a-fA-F]{1,5})|([a-zA-Z]{2,8}));/g;

const PUNCT_AFTER = /[.,;:)\]]/;
/** Replacement for a mark found with one optional space/tab on each side: keeps exactly one space between words, and none before punctuation or at a line start. */
function gap(a, b, offset, whole, matchLength) {
  const next = whole[offset + matchLength], prev = whole[offset - 1];
  if (a && b) return a;
  if (a && (next === undefined || next === "\n" || PUNCT_AFTER.test(next))) return "";
  if (b && (offset === 0 || prev === "\n")) return "";
  return a + b;
}
const inline = (kind, source, flags = "g") => {
  const re = new RegExp(`([ \\t]?)(?:${source})([ \\t]?)`, flags);
  return { kind, re, to: (m, a, b, off, whole) => gap(a, b, off, whole, m.length) };
};

/** Rules applied in this order, repeated until the text stops changing (so decoding an entity that hides a tag, and a second run, give the same result). */
export const CLEAN_RULES = [
  // picture placeholders
  inline("picture_placeholder", String.raw`<!--\s*image\s*-->|<img\b[^<>]*>|!\[[^\]\n]*\]\([^)\n]*\)|\[(?:image|picture|photo|logo|graphic|illustration)(?:\s*[:\-][^\]\n]{0,80})?\]`, "gi"),
  // HTML comments, then tags (block tags become a line break, the rest are dropped)
  { kind: "html_tag", re: /<!--[\s\S]*?-->/g, to: () => "" },
  { kind: "html_tag", re: TAG_RE, to: (m) => (BLOCK_TAG_RE.test(m) ? "\n" : /^<\/?t[dh]\b/i.test(m) ? " " : "") },
  // amendment notes: a whole footnote line ("1. Subs. by ...") and a bracketed note ("[Subs. by ...]"). Only the abbreviations Subs./Ins./Rep. are footnote style;
  // "Omitted by" / "Repealed by" can be a real status line, so they are in AMBIGUOUS_RULES.
  { kind: "amendment_note", re: /^[ \t]*\d{1,3}\.[ \t]+(?:Subs|Ins|Rep)\.(?=[^\n]*\bby\b)[^\n]*(?:\n|$)/gm, to: () => "" },
  inline("amendment_note", String.raw`\[(?:Subs|Ins|Rep)\.\s+by\b[^\[\]\n]{3,300}\]`, "g"),
  // footnote markers: markdown refs [^1] and their definition lines, and superscript digits after a letter or closing mark (not units such as m²)
  { kind: "footnote_marker", re: /^[ \t]*\[\^\d{1,3}\]:[^\n]*(?:\n|$)/gm, to: () => "" },
  inline("footnote_marker", String.raw`\[\^\d{1,3}\]`, "g"),
  { kind: "footnote_marker", re: new RegExp(`(?<![0-9${SUP}])(?<!\\b(?:m|cm|km|mm|ft|yd|in|sq))[${SUP}]+`, "g"), to: () => "" },
  // entities last: &amp; -> &, &nbsp; -> space, numeric &#8217; -> the character. Unknown names are left alone (see AMBIGUOUS_RULES).
  { kind: "html_entity", re: ENTITY_RE, to: (m, dec, hex, name) => {
      if (dec || hex) { const cp = dec ? Number(dec) : parseInt(hex, 16); return cp >= 32 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff) ? String.fromCodePoint(cp) : m; }
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m;
    } },
];

/** Kinds that are measured but never cleaned until the owner approves them. `note` says why each could be law. */
export const AMBIGUOUS_RULES = [
  { kind: "numbered_bracket", re: /(?<![\w.])\d{1,3}\[/g, note: 'amendment marker like 1[Provided that ...]: the number is a mark but the bracketed words are the current law' },
  { kind: "status_bracket", re: /\[(?:repealed|omitted|rep\.|ins\.|deleted|renumbered|expired|spent)[^\]\n]{0,120}\]/gi, note: "[Repealed] / [omitted] status information: real, kept" },
  { kind: "bracketed_proviso_or_explanation", re: /\[[^\]\n]{0,200}(?:Provided that|Explanation|Illustration)[^\]\n]{0,200}\]/g, note: "a bracketed proviso, Explanation or Illustration: real law" },
  { kind: "wef_note", re: /\(?\s*w\.e\.f\.[^)\n]{0,60}\)?/gi, note: "effective-date note; may be part of the current wording" },
  { kind: "inline_amendment_unbracketed", re: /(?<!\[)\b(?:Subs|Ins)\.\s+by\b[^\n]{0,120}/g, note: "amendment note running on inside a paragraph: its end cannot be found safely" },
  { kind: "omitted_or_repealed_by_line", re: /^[ \t]*\d{1,3}\.[ \t]+(?:Omitted|Added|Repealed|Inserted|Substituted)\b(?=[^\n]*\bby\b)[^\n]*$/gm, note: "may be a footnote or a real section status line" },
  { kind: "figure_table_placeholder", re: /\[(?:figure|fig\.|table|map|chart|diagram|form|seal|signature|illegible)[^\]\n]{0,60}\]/gi, note: "placeholder for a figure or table, or a real bracketed reference" },
  { kind: "glued_footnote_digit", re: /(?<=[a-z]{3})\d{1,2}(?=[\s,.;:)])/g, note: 'digits stuck to a word ("Act1"): a footnote number or a real name' },
  { kind: "unknown_html_entity", re: /&(?!(?:amp|lt|gt|quot|apos|nbsp|ndash|mdash|lsquo|rsquo|ldquo|rdquo|hellip|sect|para|copy|deg|times);)[a-zA-Z]{2,10};/g, note: "named entity not in the decode list" },
  { kind: "unknown_html_tag", re: new RegExp(`</?(?!${KNOWN_TAG}\\b)[a-zA-Z][^<>\\n]{0,100}>`, "g"), note: "angle-bracket text that is not a known HTML tag (may be a form placeholder)" },
  { kind: "printed_omission_marks", re: /\*\s?\*\s?\*/g, note: "* * * printed omission marks: real, kept" },
  { kind: "replacement_or_control_char", re: /[\u0000-\u0008\u000b\u000c\u000e-\u001f�]/g, note: "lost characters: already flagged by the quality labels, not cleaned here" },
];

const MAX_PASSES = 5;

/** Removes the marks in CLEAN_RULES. Returns { text, changed, kinds } where kinds counts removals per kind. Running it on its own output changes nothing. */
export function cleanMarks(input) {
  if (typeof input !== "string" || input === "") return { text: typeof input === "string" ? input : "", changed: false, kinds: {} };
  const kinds = {};
  let text = input;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = text;
    for (const r of CLEAN_RULES) {
      text = text.replace(r.re, (...args) => {
        const out = r.to(...args);
        if (out !== args[0]) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
        return out;
      });
    }
    if (text === before) break;
  }
  return { text, changed: text !== input, kinds };
}

/** Where each mark sits, for measuring: [{ kind, group: "clean" | "ambiguous", index, match }]. Nothing is changed. */
export function findMarks(text) {
  const out = [];
  if (typeof text !== "string" || !text) return out;
  for (const r of CLEAN_RULES) for (const m of text.matchAll(r.re)) {
    const probe = r.to(...m, m.index, text);
    if (probe !== m[0]) out.push({ kind: r.kind, group: "clean", index: m.index, match: m[0].trim() });
  }
  // an ambiguous match that lies inside something the cleaner already removes is not ambiguous any more
  const cleanSpans = out.map((f) => [f.index, f.index + f.match.length]);
  for (const r of AMBIGUOUS_RULES) for (const m of text.matchAll(r.re)) {
    const s = m.index, e = s + m[0].length;
    if (cleanSpans.some(([a, b]) => s < b && e > a)) continue;
    out.push({ kind: r.kind, group: "ambiguous", index: s, match: m[0] });
  }
  return out;
}

/** Any other bracketed text, normalised (digits become #), for the "anything else" histogram: [{ key, example }] for brackets no other rule explains. */
export function otherBrackets(text) {
  const taken = findMarks(text).map((f) => [f.index, f.index + f.match.length]);
  const out = [];
  for (const m of text.matchAll(/\[[^\[\]\n]{1,80}\]/g)) {
    const s = m.index, e = s + m[0].length;
    if (taken.some(([a, b]) => s < b && e > a)) continue;
    out.push({ key: m[0].replace(/\d+/g, "#").toLowerCase(), example: m[0], index: s });
  }
  return out;
}

/** A readable slice of text around a mark, line breaks shown as ⏎. */
export function contextAround(text, index, length, radius = 60) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + length + radius)).replace(/\n/g, "⏎");
}
