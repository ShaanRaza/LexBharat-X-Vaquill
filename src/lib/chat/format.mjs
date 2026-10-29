import { previewText } from "../text/clean.mjs";
// Turns a model answer into simple blocks for display: paragraphs and bullet / numbered lists. PURE logic. Bold markers are dropped (the prompt asks for plain text; this is the safety net).
export function toBlocks(text) {
  const blocks = []; let cur = null;
  for (const raw of String(text).replace(/\*\*/g, "").replace(/^#{1,6}\s+/gm, "").split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim()) { cur = null; continue; }
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      const type = /^\s*\d/.test(line) ? "ol" : "ul";
      if (!cur || cur.type !== type) { cur = { type, items: [] }; blocks.push(cur); }
      cur.items.push(li[1].trim());
    } else if (cur && cur.type === "p") cur.text += " " + line.trim();
    else { cur = { type: "p", text: line.trim() }; blocks.push(cur); }
  }
  return blocks;
}

/** A short readable preview of a section's text (for unnumbered sources): the shared display layer (src/lib/text/clean.mjs) cleans it and skips headings. */
export const previewOf = (text, max = 140) => previewText(text, max);
