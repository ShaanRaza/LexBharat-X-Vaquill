// Quick-find (⌘K): what to search for and how to order what comes back. PURE logic (no styling, no network). It uses keyword and exact-word search only, never a search by meaning, so typing never
// spends the free Voyage limit (3 requests a minute for the whole app).
export const MIN_CHARS = 2;
const CITATION = /^\s*(?:(?:section|sec\.?|s\.?)\s*)?\d{1,4}[A-Za-z]{0,3}\s+(?:of\s+)?(?:the\s+)?[A-Za-z]|^\s*(?:order|o\.?)\s*\d+\s*(?:rule|r\.?)\s*\d+|^\s*art(?:icle|\.)?\s*\d+/i;
const CASE_NAME = /\s(?:v\.?|vs\.?|versus)\s/i;
/** A section, order-and-rule or article citation ("138 NI Act", "Order 7 Rule 11", "Article 21"). */
export const looksLikeCitation = (q) => CITATION.test(String(q ?? ""));
/** Two parties joined by "v.", "vs" or "versus". */
export const looksLikeCaseName = (q) => CASE_NAME.test(String(q ?? ""));
/** The order the groups are shown in: a citation puts Laws first, a case name puts Judgments first, everything else shows Laws, Judgments, Your work. */
export function groupOrder(q) {
  if (looksLikeCaseName(q)) return ["judgments", "laws", "work"];
  if (looksLikeCitation(q)) return ["laws", "judgments", "work"];
  return ["laws", "judgments", "work"];
}
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
/** Your own work (chats, drafts, reviews, documents) that matches: every word of the query appears in the title; titles that start with the query come first; at most `limit`. */
export function matchWork(items, q, limit = 5) {
  const words = norm(q).split(" ").filter(Boolean); if (!words.length) return [];
  return items.map((it) => ({ it, t: norm(it.title) })).filter(({ t }) => words.every((w) => t.includes(w)))
    .sort((a, b) => Number(b.t.startsWith(words[0])) - Number(a.t.startsWith(words[0])) || String(b.it.updatedAt ?? "").localeCompare(String(a.it.updatedAt ?? ""))).slice(0, limit).map((x) => x.it);
}
/** Enter opens the first result of the first group that has one. */
export function topResult(groups, order) { for (const g of order) if (groups[g]?.length) return { group: g, item: groups[g][0] }; return null; }
