// The draft document. PURE logic. A draft is stored as editor JSON (TipTap / ProseMirror): headings, paragraphs (with line breaks), bullet and numbered lists, bold / italic / underline.
// Here: section text -> that JSON, the JSON -> plain text and -> simple blocks for the .docx and PDF exports, and checks on placeholders and statute references.
import { findStatuteMentions } from "../chat/citations.mjs";

const PLACEHOLDER = /\[[A-Z][A-Z0-9 '’\/&.,:-]{2,80}\]/g;
export const NOT_GENERATED = (title) => `[SECTION NOT GENERATED: ${title.toUpperCase()}. USE RETRY.]`;
export const placeholdersIn = (text) => [...new Set(String(text).match(PLACEHOLDER) ?? [])];

const T = (text, marks) => ({ type: "text", text, ...(marks?.length ? { marks } : {}) });
/** "a **bold** b" -> text nodes with bold marks. */
function inline(line) {
  const out = []; let bold = false;
  for (const part of line.split("**")) { if (part) out.push(T(part, bold ? [{ type: "bold" }] : null)); bold = !bold; }
  return out;
}
const para = (lines) => ({ type: "paragraph", content: lines.flatMap((l, i) => (i ? [{ type: "hardBreak" }, ...inline(l)] : inline(l))) });

/** Model text for one section -> editor nodes. Lines: "## X" heading, "- x" bullets, "1. x" numbered items (one list per run), anything else is a paragraph (single line breaks kept as line breaks). */
export function textToNodes(text, orderedStart = null) {
  const nodes = []; let p = [], list = null, next = orderedStart;
  const flushP = () => { if (p.length) { nodes.push(para(p)); p = []; } };
  const flushL = () => {
    if (!list) return;
    const attrs = list.type === "orderedList" && next !== null ? { attrs: { start: next } } : {};
    if (list.type === "orderedList" && next !== null) next += list.items.length;
    nodes.push({ type: list.type, ...attrs, content: list.items.map((it) => ({ type: "listItem", content: [para([it])] })) }); list = null;
  };
  for (const raw of String(text).replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd(), h = /^(#{1,3})\s+(.*)$/.exec(line), b = /^\s*[-•*]\s+(.*)$/.exec(line), n = /^\s*\d{1,2}[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) { flushP(); flushL(); }
    else if (h) { flushP(); flushL(); nodes.push({ type: "heading", attrs: { level: Math.min(3, Math.max(2, h[1].length + 1)) }, content: inline(h[2].replace(/\*\*/g, "")) }); }
    else if (b || n) { flushP(); const type = n ? "orderedList" : "bulletList"; if (!list || list.type !== type) { flushL(); list = { type, items: [] }; } list.items.push((b ?? n)[1].trim()); }
    else { flushL(); p.push(line.trim()); }
  }
  flushP(); flushL();
  return nodes;
}

/** How many numbered ("1.") items a section's text has (to carry the numbering on into the next section of a notice). */
export const countNumbered = (text) => textToNodes(text).filter((n) => n.type === "orderedList").reduce((a, n) => a + n.content.length, 0);

/** The whole draft: the title, then every section in order. sections: [{ id, title, text, status: "ok" | "failed" }]. A failed section is a visible marker paragraph (the editor lists it for retry).
 *  continueNumbering (notices): numbered paragraphs run on through the whole document instead of restarting at 1 in every section. */
export function buildDoc(docTitle, sections, { continueNumbering = false } = {}) {
  const content = [{ type: "heading", attrs: { level: 1 }, content: [T(docTitle)] }]; let n = 1;
  for (const s of sections) {
    if (s.status === "failed" || !s.text?.trim()) { content.push(para([NOT_GENERATED(s.title)])); continue; }
    content.push(...textToNodes(s.text, continueNumbering ? n : null)); if (continueNumbering) n += countNumbered(s.text);
  }
  return { type: "doc", content };
}

// ---- reading the JSON
const runsOf = (node) => {
  const runs = [];
  for (const c of node.content ?? []) {
    if (c.type === "text") runs.push({ text: c.text, bold: !!c.marks?.some((m) => m.type === "bold"), italics: !!c.marks?.some((m) => m.type === "italic"), underline: !!c.marks?.some((m) => m.type === "underline") });
    else if (c.type === "hardBreak") runs.push({ text: "\n" });
    else runs.push(...runsOf(c));
  }
  return runs;
};
/** Blocks for the exports: [{ type: "heading", level, runs } | { type: "p", runs } | { type: "list", ordered, items: [runs] }]. */
export function docToBlocks(doc) {
  const out = [];
  for (const n of doc?.content ?? []) {
    if (n.type === "heading") out.push({ type: "heading", level: n.attrs?.level ?? 2, runs: runsOf(n) });
    else if (n.type === "paragraph") out.push({ type: "p", runs: runsOf(n) });
    else if (n.type === "bulletList" || n.type === "orderedList") out.push({ type: "list", ordered: n.type === "orderedList", start: n.attrs?.start ?? 1, items: (n.content ?? []).map((li) => (li.content ?? []).flatMap((x) => runsOf(x))) });
    else if (n.type === "blockquote") for (const c of n.content ?? []) out.push({ type: "p", runs: runsOf(c) });
  }
  return out;
}
/** Plain text of the draft (for Copy and for checks). */
export function docToText(doc) {
  return docToBlocks(doc).map((b) => (b.type === "list" ? b.items.map((it, i) => `${b.ordered ? `${b.start + i}.` : "-"} ${it.map((r) => r.text).join("")}`).join("\n") : b.runs.map((r) => r.text).join(""))).join("\n\n");
}

/** References to law in the draft that were NOT among the retrieved sections: "Section 420 of the Indian Penal Code" when no such source was retrieved. Only mentions that name an Act are checked.
 *  sources: [{ n, number, actTitle }]. Returns [{ text }]. */
export function unverifiedMentions(text, sources) {
  return findStatuteMentions(text, sources).filter((m) => !m.source).map((m) => ({ text: m.text }));
}

/** Amounts in a text ("₹2,50,000", "Rs. 5,000") that appear in neither the given facts nor the retrieved sources. Used to catch invented figures. allowed: strings to search. */
export function inventedAmounts(text, allowed) {
  const hay = allowed.join(" ").replace(/,/g, ""), found = new Set();
  for (const m of text.matchAll(/(?:₹|Rs\.?|INR)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi)) { const n = m[1].replace(/,/g, ""); if (!new RegExp(`(^|\\D)${n.replace(".", "\\.")}(\\D|$)`).test(hay)) found.add(m[0]); }
  return [...found];
}

// ---- accepting a document from the browser (autosave)
const OK_NODES = new Set(["doc", "paragraph", "heading", "text", "hardBreak", "bulletList", "orderedList", "listItem", "blockquote"]);
const OK_MARKS = new Set(["bold", "italic", "underline", "strike"]);
/** True when `doc` is editor JSON that only uses the node and mark types the editor and the exports know, within sane limits. Anything else is refused, so a stored draft is always exportable. */
export function validDoc(doc, maxNodes = 20000) {
  let count = 0;
  const walk = (n, depth) => {
    if (!n || typeof n !== "object" || depth > 8 || ++count > maxNodes || !OK_NODES.has(n.type)) return false;
    if (n.type === "text" && (typeof n.text !== "string" || n.text.length > 20000)) return false;
    if (n.marks && !(Array.isArray(n.marks) && n.marks.every((m) => m && OK_MARKS.has(m.type)))) return false;
    if (n.type === "heading" && ![1, 2, 3].includes(n.attrs?.level)) return false;
    return (n.content ?? []).every((c) => walk(c, depth + 1));
  };
  return doc?.type === "doc" && Array.isArray(doc.content) && walk(doc, 0);
}
