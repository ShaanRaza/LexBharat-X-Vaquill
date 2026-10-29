// THE display-text layer: every page that shows text taken from the data (Acts, regulator instruments, judgments, Vault files, search snippets, previews, the text the answer model reads) cleans it through here.
// PURE logic, no styling. The data keeps the raw text; nothing here is ever written back. Junk it removes (counts from docs/audit-junk-*.json): "==> picture ... omitted <==" markers, HTML tags and entities, runs of lost
// characters, literal backslash escapes, markdown marks, amendment numbers such as 4[words] (shown as a footnote mark in reading views, dropped in plain text), spaced brackets "( a )", spaces before punctuation, joined words.
import { amendParts, vocabOf } from "./amend.mjs";
export { amendParts, vocabOf };

/** Joins runs of single letters separated by single spaces ("C H A P T E R" -> "CHAPTER"). Returns { text, ambiguous }: a run of 10+ letters (a whole
 *  phrase spaced out, e.g. "O F I N T E R N A T I O N A L") has lost its word breaks, so the joined result cannot be trusted and `ambiguous` is true. */
export function collapseLetterSpacing(line) {
  let ambiguous = false;
  const text = line.replace(/(?<![A-Za-z0-9])((?:[A-Za-z] ){3,}[A-Za-z])(?![A-Za-z0-9])/g, (run) => {
    const joined = run.replace(/ /g, "");
    if (joined.length >= 10) ambiguous = true;
    return joined;
  });
  return { text, ambiguous };
}

/** Markdown artifacts the extraction left behind: **bold**, ## headings, ( _a_ ) clause markers, _italic_. */
export function stripMarkdown(s) {
  return s
    .replace(/\(\s*_([A-Za-z0-9ivxIVX]+)_\s*\)/g, "($1)")
    .replace(/\*\*/g, "")
    .replace(/`([^`\n]*)`/g, "$1")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, "$1")
    .replace(/(?<=[A-Za-z0-9])_(?=[\s,.;:)\]]|$)/gm, "").replace(/(^|[\s(\[])_(?=[A-Za-z0-9])/gm, "$1")   // one half of an emphasis pair left behind when a snippet or the source cut the text in the middle
    .replace(/^[ \t]*-{3,}[ \t]*$/gm, "").replace(/[ \t]*(?<![|:-])-{3,}(?![|:-])[ \t]*/g, " \u2014 ")   // lines of dashes are rules, dashes inside a line are a long dash
    .replace(/[ \t]+$/g, "");
}

/** Blocks for rendering one section's raw text: [{ type: "heading" | "p", text }]. Headings are lines written as markdown "## ..." in the source. */
export function toDisplayBlocks(raw, { lines = false } = {}) {
  const blocks = [];
  // the dataset's text breaks paragraphs at a blank line (a single line break is only a wrap); the hand-filled units (content/supplement) put each clause, entry or list item on its own line
  for (const para of raw.split(lines ? /\n+/ : /\n{2,}/)) {
    const t = tidySpacing(stripJunk(para)).trim();   // junk first, so a paragraph that was only a picture placeholder disappears
    if (!t) continue;
    const isHeading = /^#{1,6}\s/.test(t);
    const spaced = collapseLetterSpacing(stripMarkdown(t.replace(/^#{1,6}\s*/, "")).replace(/\s*\n\s*/g, " "));
    const text = spaced.text.replace(/^[-*]\s+/, "• ");
    if (isHeading && spaced.ambiguous) continue; // a heading whose words cannot be recovered is omitted rather than shown wrong
    blocks.push({ type: isHeading ? "heading" : "p", text });
  }
  return blocks;
}

/** Heading text for display (null when the words cannot be recovered, or when it holds Hindi or lost characters: those cannot be verified, see HINDI_PIECE_MIN in reassemble.mjs). */
export function cleanHeading(s) {
  if (!s) return null;
  if (/\uFFFD/.test(s) || (s.match(/[\u0900-\u097F]/g) ?? []).length >= 4) return null;
  const c = collapseLetterSpacing(stripMarkdown(s).replace(/^#{1,6}\s*/, ""));
  return c.ambiguous ? null : c.text.trim() || null;
}


// ---- the shared display layer
const ENTITIES = { amp: "&", nbsp: " ", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", "#8217": "\u2019", "#8211": "\u2013" };
/** Extraction junk that is never text: picture placeholders, HTML, control characters, runs of lost characters, literal backslash escapes. */
export function stripJunk(raw) {
  return String(raw ?? "")
    .replace(/\*{0,2}={2,}>[^<\n]{0,160}?<={2,}\*{0,2}/g, " ")          // "**==> picture [174 x 68] intentionally omitted <==**"
    .replace(/={2,}>|<={2,}/g, " ")                                        // a marker whose other half is missing
    .replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(?:b|i|u|p|span|div|font|table|tr|td|th|li|ul|ol|a|sup|sub|em|strong|h[1-6])(?:\s[^<>]{0,40})?\/?>/gi, "")
    .replace(/&(#?[a-z0-9]{2,6});/gi, (m, k) => ENTITIES[k.toLowerCase()] ?? m)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/(?:\s*\uFFFD){2,}/g, " ").replace(/^[ \t]*\uFFFD+[ \t]*$/gm, "")   // "� � �", also across line breaks, and a line of nothing but lost characters
    .replace(/(?<![A-Za-z])\\[nrt](?![A-Za-z])/g, " ");                   // a literal \n left by the extraction (not inside a word: "\nvolving" is OCR for "involving" and is left alone)
}
/** Spacing the extraction broke: "( a )" -> "(a)", "word ." -> "word.", runs of spaces and tabs -> one space (line breaks are kept). */
export function tidySpacing(s) {
  return s
    .replace(/\(\s+([A-Za-z0-9]{1,4})\s+\)/g, "($1)")
    .replace(/([A-Za-z0-9)\]]) +([.,;:])(?=[ \t]*$|[ \t]+(?!\d))/gm, "$1$2")   // not "1 . 5" (a decimal point)
    .replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "");
}
/** Parts for a reading view: [{ t: "text", v } | { t: "mark", n }]. A mark is a footnote number where amended words end. `vocab` (vocabOf the section's paragraphs) lets "thecheque" read "the cheque". */
export const cleanParts = (raw, vocab) => amendParts(tidySpacing(stripJunk(stripMarkdown(stripJunk(raw))).replace(/^[ \t\u00a0]*#{1,6}[ \t\u00a0]+/gm, "")), vocab).map((p) => (p.t === "text" ? { t: "text", v: p.v.replace(/ {2,}/g, " ") } : p));
/** The same text as one plain string (previews, snippets, titles of passages, the sources the answer model reads): footnote numbers are dropped. */
export const cleanPlain = (raw, vocab) => tidySpacing(cleanParts(raw, vocab).map((p) => (p.t === "text" ? p.v : "")).join("")).replace(/\n{3,}/g, "\n\n").trim();
/** A short readable preview: cleaned, headings and all-capital heading lines skipped, at most `max` characters. */
export function previewText(raw, max = 140) {
  const t = String(raw ?? "").split(/\n{2,}/).filter((p) => !/^\s*#/.test(p)).map((p) => cleanPlain(p)).filter((p) => p && !(p.length < 120 && p === p.toUpperCase() && /[A-Z]/.test(p))).join(" ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + " \u2026" : t;
}

/** A heading, chapter or preview taken from the data, ready to print: cleaned, on one line, "" when there is nothing. */
export const cleanLabel = (s) => (s ? cleanPlain(String(s)).replace(/\s+/g, " ").trim() : "");
