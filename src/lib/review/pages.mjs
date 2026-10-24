// Which page of the document a reviewed clause is on, and whether that page was read from a scan. PURE logic.
import { pageAt } from "../vault/chunk.mjs";

/** Where `quote` starts inside `piece`, ignoring differences in spaces and line breaks (the model quotes on one line what the page has on several). -1 when it is not there. */
export function locate(piece, quote) {
  if (!quote) return -1;
  const exact = piece.indexOf(quote); if (exact >= 0) return exact;
  let flat = "", map = [], space = true;
  for (let i = 0; i < piece.length; i++) { const c = piece[i]; if (/\s/.test(c)) { if (!space) { flat += " "; map.push(i); space = true; } } else { flat += c; map.push(i); space = false; } }
  const q = quote.replace(/\s+/g, " ").trim(), at = flat.toLowerCase().indexOf(q.toLowerCase());
  return at >= 0 ? map[at] : -1;
}

/** The page of a clause: where its quote sits inside the part that was reviewed (else where the part starts). null when the document has no page numbers. */
export function clausePage(text, part, quote, pageStarts) {
  if (!pageStarts?.length) return null;
  const piece = text.slice(part.start, part.end);
  return pageAt(pageStarts, part.start + Math.max(0, locate(piece, quote)));
}
/** Adds `page` (and `scan` when that page was read from an image) to each clause. */
export function annotateClauses(clauses, text, part, pageStarts, scanPages) {
  const scan = new Set(scanPages ?? []);
  return clauses.map((c) => { const page = clausePage(text, part, c.quote, pageStarts); return { ...c, page, ...(page && scan.has(page) ? { scan: true } : {}) }; });
}
