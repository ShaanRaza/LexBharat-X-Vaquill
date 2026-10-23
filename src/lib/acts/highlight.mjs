// Search snippets mark matched words with two private-use characters (the database adds them; the UI turns them into highlights). PURE logic.
export const MARK_OPEN = "", MARK_CLOSE = "";

/** "a hit b" -> [{ text: "a ", hit: false }, { text: "hit", hit: true }, { text: " b", hit: false }]. Markdown artifacts are removed from the plain parts too. */
export function splitHighlight(snippet) {
  const out = [];
  const plain = (s) => s.replace(/\*\*/g, "").replace(/\s+/g, " ");
  let rest = snippet ?? "";
  while (rest.length) {
    const a = rest.indexOf(MARK_OPEN);
    if (a < 0) { out.push({ text: plain(rest), hit: false }); break; }
    if (a > 0) out.push({ text: plain(rest.slice(0, a)), hit: false });
    const b = rest.indexOf(MARK_CLOSE, a + 1);
    if (b < 0) { out.push({ text: plain(rest.slice(a + 1)), hit: false }); break; }
    out.push({ text: plain(rest.slice(a + 1, b)), hit: true });
    rest = rest.slice(b + 1);
  }
  return out.filter((p) => p.text);
}
