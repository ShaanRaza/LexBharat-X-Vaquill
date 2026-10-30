// A question that touches more than one Act or issue: every Act the query rewrite named gets a small share of the sections, so the strongest Act cannot take every slot. PURE logic.
const GENERIC = new Set(["the", "of", "and", "act", "code", "sanhita", "adhiniyam", "indian", "india", "central", "state", "for", "in", "to", "on", "a"]);
const words = (t) => String(t ?? "").toLowerCase().replace(/\b(1[89]|20)\d\d\b/g, " ").replace(/\([^)]*\)/g, " ").match(/[a-z]{3,}/g)?.filter((w) => !GENERIC.has(w)) ?? [];
/** Does the query name this Act? At least 60% of the Act title's own words (no year, no "Act") occur in the query. */
export function namesAct(query, actTitle) {
  const t = [...new Set(words(String(actTitle).split(",")[0])) ], q = new Set(words(query));
  return t.length > 0 && t.filter((w) => q.has(w)).length / t.length >= 0.6;
}
/** merged: the merged ranking (keys). lists: one ranked list of keys per search query, with `queries[i]` the text of query i. actOf(key) -> { id, title }. Returns the ranking with every named Act holding at least `min` places,
 *  never more than `limit` in all, and with `protect` keys (exact lookups) kept. The places are reserved only when the queries lead to two or more different Acts and for the Acts a query actually NAMED; when they all lead to one Act the ranking is returned unchanged, so a one-Act question behaves exactly as before. */
export function ensureActShare(merged, lists, queries, actOf, { limit = 10, min = 2, protect = [] } = {}) {
  const groups = [], tops = new Set();
  lists.forEach((l, i) => { const top = l[0]; if (!top) return; const a = actOf(top); if (!a) return; tops.add(a.id); if (namesAct(queries[i] ?? "", a.title) && !groups.some((g) => g.id === a.id)) groups.push({ id: a.id, title: a.title, from: i }); });
  if (tops.size < 2 || !groups.length) return merged;   // the queries all lead to one Act: a one-Act question keeps exactly the ranking it had
  const out = [...merged], hold = new Set(protect), idOf = (k) => actOf(k)?.id;
  for (const g of groups) {
    let have = out.filter((k) => idOf(k) === g.id).length;
    if (have >= min) continue;
    const pool = lists.flat().filter((k, i, arr) => idOf(k) === g.id && !out.includes(k) && arr.indexOf(k) === i);   // best-ranked first within each list, lists in query order
    const ranked = [...lists[g.from].filter((k) => idOf(k) === g.id && !out.includes(k)), ...pool];
    for (const k of [...new Set(ranked)]) {
      if (have >= min) break;
      if (out.length >= limit) {   // make room: drop the lowest-ranked place of an Act that holds more than its minimum
        const count = (id) => out.filter((x) => idOf(x) === id).length;
        const drop = [...out].reverse().find((x) => !hold.has(x) && idOf(x) !== g.id && (count(idOf(x)) > min || !groups.some((h) => h.id === idOf(x))));
        if (!drop) break;
        out.splice(out.indexOf(drop), 1);
      }
      out.push(k); have++;
    }
  }
  return out.slice(0, limit);
}
