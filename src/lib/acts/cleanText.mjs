// Display-only cleanup for section text. PURE logic, no styling. The data files keep the raw text; nothing here is ever written back.

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
    .replace(/(?<![A-Za-z0-9])_([^_\n]+)_(?![A-Za-z0-9])/g, "$1")
    .replace(/[ \t]+$/g, "");
}

/** Blocks for rendering one section's raw text: [{ type: "heading" | "p", text }]. Headings are lines written as markdown "## ..." in the source. */
export function toDisplayBlocks(raw, { lines = false } = {}) {
  const blocks = [];
  // the dataset's text breaks paragraphs at a blank line (a single line break is only a wrap); the hand-filled units (content/supplement) put each clause, entry or list item on its own line
  for (const para of raw.split(lines ? /\n+/ : /\n{2,}/)) {
    const t = para.trim();
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
