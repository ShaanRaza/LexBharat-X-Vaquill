// Pure helpers for the judgment reader (long judgments shown in steps, with search inside the text). No DOM, no styling.

/** Every place `query` occurs in `text`, case-insensitively, as [{ start, end }]. A query shorter than 2 characters finds nothing. */
export function findMatches(text, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (q.length < 2) return [];
  const low = text.toLowerCase(), out = [];
  for (let at = low.indexOf(q); at >= 0; at = low.indexOf(q, at + q.length)) out.push({ start: at, end: at + q.length });
  return out;
}

/** Pieces of a paragraph for display: [{ text, href?, title?, hit?, active? }]. `mentions` = Act-section links ({ start, end, href, title }), `hits` = search matches ({ start, end }),
 *  `activeStart` = the start offset of the match currently selected (or -1). Pieces are cut at every boundary, so a link and a highlight can overlap. */
export function buildSegments(text, mentions = [], hits = [], activeStart = -1) {
  const cuts = new Set([0, text.length]);
  for (const m of mentions) { if (m.href) { cuts.add(Math.max(0, m.start)); cuts.add(Math.min(text.length, m.end)); } }
  for (const h of hits) { cuts.add(h.start); cuts.add(h.end); }
  const pts = [...cuts].filter((n) => n >= 0 && n <= text.length).sort((a, b) => a - b), out = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const s = pts[i], e = pts[i + 1];
    if (e <= s) continue;
    const m = mentions.find((x) => x.href && x.start <= s && x.end >= e), h = hits.find((x) => x.start <= s && x.end >= e);
    out.push({ text: text.slice(s, e), ...(m ? { href: m.href, title: m.title } : {}), ...(h ? { hit: true, ...(h.start === activeStart ? { active: true } : {}) } : {}) });
  }
  return out;
}

/** The number a paragraph starts with ("12. The appellant ..." or "(12) The ..."), or null. Used to show and link paragraph numbers only where the text itself has them. */
export function leadingNumber(text) {
  const m = /^\s*(?:\((\d{1,3})\)|(\d{1,3})\.)\s+\S/.exec(text);
  return m ? Number(m[1] ?? m[2]) : null;
}

/** "para 12", "paragraph 12", "¶12" -> 12; anything else null. */
export function paragraphRequest(q) {
  const m = /^\s*(?:paras?\.?|paragraphs?|¶)\s*(\d{1,3})\s*$/i.exec(String(q ?? ""));
  return m ? Number(m[1]) : null;
}
