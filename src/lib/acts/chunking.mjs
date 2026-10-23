// Splitting section text into chunks for embeddings. PURE logic. Each chunk starts with a one-line context prefix (Act, section, heading) so a short
// sub-section still says what it belongs to; long sections are cut on paragraph boundaries (then sentences) to stay under `max` characters.
import { toDisplayBlocks } from "./cleanText.mjs";

export const CHUNK_TARGET = 1800, CHUNK_MAX = 2400; // characters (about 450 and 600 tokens of English)

const splitSentences = (t) => t.match(/[^.;]+[.;]+["')\]]*\s*|[^.;]+$/g) ?? [t];

/** Pieces of at most `max` characters: whole paragraphs where possible, sentences for an over-long paragraph, a hard cut as the last resort. */
export function splitBody(paragraphs, target = CHUNK_TARGET, max = CHUNK_MAX) {
  const units = [];
  for (const p of paragraphs) {
    if (p.length <= max) { units.push(p); continue; }
    let cur = "";
    for (const s of splitSentences(p)) {
      if (s.length > max) { if (cur) { units.push(cur.trim()); cur = ""; } for (let i = 0; i < s.length; i += max) units.push(s.slice(i, i + max).trim()); continue; }
      if ((cur + s).length > target && cur) { units.push(cur.trim()); cur = s; } else cur += s;
    }
    if (cur.trim()) units.push(cur.trim());
  }
  const out = [];
  let cur = "";
  for (const u of units) {
    if (cur && (cur.length + u.length + 2 > target)) { out.push(cur); cur = u; } else cur = cur ? `${cur}\n\n${u}` : u;
  }
  if (cur) out.push(cur);
  return out;
}

/** One section -> chunks [{ text, part, parts }]. `section` = { actTitle, year, number, heading, body }. Returns [] for a section with no text. */
export function chunkSection(section, opts = {}) {
  const paras = toDisplayBlocks(section.body ?? "").map((b) => b.text).filter(Boolean);
  if (!paras.length) return [];
  const label = [section.actTitle + (section.year ? ` (${section.year})` : ""), section.number ? `Section ${section.number}` : "Text block", section.heading].filter(Boolean).join(" — ");
  const pieces = splitBody(paras, opts.target, opts.max);
  return pieces.map((p, i) => ({ text: `${label}\n${p}`, part: i + 1, parts: pieces.length }));
}
