// Orders, Rules and Articles of an Act's Schedules are stored with a short number: O39R1 (Order 39 Rule 1), O39 (the Order itself), A137 (Article 137). PURE logic: number in, words out.
const UNIT = /^(?:O(\d{1,3})([A-Z]{0,2})(?:R(\d{1,3})([A-Z]{0,2}))?|A(\d{1,3})([A-Z]{0,2})|S(\d{1,2}))$/;
const ORDINAL = ["", "First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];

/** { kind: "order" | "rule" | "article", order?, rule?, article? } for a unit number, or null for an ordinary section number. */
export function parseUnitNumber(number) {
  const m = UNIT.exec(String(number ?? "").toUpperCase());
  if (!m) return null;
  if (m[7]) return { kind: "schedule", schedule: m[7] };
  if (m[5]) return { kind: "article", article: `${m[5]}${m[6]}` };
  return m[3] ? { kind: "rule", order: `${m[1]}${m[2]}`, rule: `${m[3]}${m[4]}` } : { kind: "order", order: `${m[1]}${m[2]}` };
}

/** "Order 39 Rule 1", "Order 39", "Article 137"; null for an ordinary section number. */
export function unitLabel(number) {
  const u = parseUnitNumber(number);
  if (!u) return null;
  if (u.kind === "schedule") return `${ORDINAL[Number(u.schedule)] ?? u.schedule} Schedule`;
  return u.kind === "article" ? `Article ${u.article}` : u.kind === "rule" ? `Order ${u.order} Rule ${u.rule}` : `Order ${u.order}`;
}

/** Reading order inside an Act, after all ordinary sections: Orders and their Rules in order, Articles in order. */
export function unitOrd(number, afterOrd) {
  const u = parseUnitNumber(number);
  if (!u) return null;
  const idx = (s) => { const m = /^(\d+)([A-Z]*)$/.exec(s); return m ? Number(m[1]) * 30 + (m[2] ? m[2].charCodeAt(0) - 64 : 0) : 0; };
  if (u.kind === "schedule") return afterOrd + 1 + 5_000_000 + Number(u.schedule);   // Schedules come after all the Articles
  return afterOrd + 1 + (u.kind === "article" ? idx(u.article) : idx(u.order) * 1000 + (u.rule ? idx(u.rule) + 1 : 0));
}

/** "Order 39 Rule 1", "Article 137" or "Section 138": the words that name a section number or a Schedule unit. */
export const sectionWord = (number) => unitLabel(number) ?? `Section ${number}`;
