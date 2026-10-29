// The same section filed twice (a State or reprint copy of a Central Act, "The INDIAN PENAL CODE" next to "The Indian Penal Code, 45 of 1860"): one result, never two. PURE logic.
import { copyKey } from "./semantic.mjs";

/** hits: [{ actId, sectionKey, actTitle, number, ... }] best first. Keeps the first of every section (same title and number as copyKey reads them) and counts the others in `copies`. Hits without a number are never merged. */
export function dedupeCopies(hits) {
  const byKey = new Map(), out = [];
  for (const h of hits) {
    const k = copyKey(h.actTitle ?? h.title, h.number);
    if (!k) { out.push(h); continue; }
    const first = byKey.get(k);
    if (first) { first.copies = (first.copies ?? 0) + 1 + (h.copies ?? 0); continue; }
    const kept = { ...h }; byKey.set(k, kept); out.push(kept);
  }
  return out;
}
