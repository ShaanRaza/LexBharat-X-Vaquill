// Which sources satisfy an expected ("gold") section. PURE helpers + one database lookup, shared by the live scorer (e2e.mjs) and the re-scorer (rescore.mjs) so both use ONE rule.
// Rule: an expected section is satisfied by ANY filing of the same Act's section: the Central filing the question names, or another filing of the same provision (the database holds many State filings of the same Central Act,
// e.g. 15 filings of the Code of Criminal Procedure) = same section number, same wording (the question's anchor sentence is in its text), and an Act title with the same year (or no year). A different Act with similar words
// (BNSS for CrPC) has another year, so it never counts.
export const normTitle = (t) => String(t ?? "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/^\s*the\s+/, "").trim();
export const yearOf = (t) => (/\b(1[89]\d\d|20\d\d)\b/.exec(String(t ?? "")) ?? [])[1] ?? null;
const numKey = (n) => String(n ?? "").trim().toUpperCase();

/** strict = rows of the Central filing found by the old rule; returns strict rows first, then the other filings of the same sections. db.query(sql, params) -> rows. anchorNorm = the anchor sentence, lower-cased, letters and digits only. */
export async function widenGold(db, strict, anchorNorm) {
  if (!strict.length) return strict;
  const years = new Set(strict.map((r) => yearOf(r.title)).filter(Boolean)), numbers = [...new Set(strict.map((r) => numKey(r.number)))];
  const wide = await db.query(`SELECT s.act_id, s.section_key, s.number, a.title FROM acts a JOIN act_sections_v s ON s.act_id = a.act_id WHERE upper(s.number) = ANY($1) AND s.body IS NOT NULL AND regexp_replace(lower(s.body), '[^a-z0-9]+', ' ', 'g') LIKE '%' || $2 || '%'`, [numbers, anchorNorm]);
  const have = new Set(strict.map((r) => `${r.act_id}|${r.section_key}`));
  return [...strict, ...wide.filter((r) => !have.has(`${r.act_id}|${r.section_key}`) && (!yearOf(r.title) || !years.size || years.has(yearOf(r.title))))];
}
/** Does this source (live: { actId, sectionKey, actTitle, number }; stored row: { t, s }) satisfy the expectation `filings`? */
export function satisfies(src, filings) {
  const title = normTitle(src.actTitle ?? src.t), number = numKey(src.number ?? src.s);
  return filings.some((g) => (src.actId && `${g.act_id}|${g.section_key}` === `${src.actId}|${src.sectionKey}`) || (number === numKey(g.number) && title && title === normTitle(g.title)));
}
