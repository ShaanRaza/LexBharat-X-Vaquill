// Search quality helpers that need no AI call. PURE logic (no database, no network): everyday words -> statutory words, "directly applicable" over "loosely similar" by comparing the query's words with a section's heading
// and opening, and the hybrid order in which keyword hits may BOOST a result found by meaning but never outrank it.

const STOP = new Set("a an and are as at be by can do does for from get has have how i if in is it its my of on or the to what when where which who whom why will with would you your after before about into over under than that this there their".split(" "));
/** The meaningful words of a text, lower case, with a plural or -ed/-ing ending trimmed so "cheques" matches "cheque" and "bounced" matches "bounce". */
export const stem = (w) => (w.length > 5 && /(?:ing|ed)$/.test(w) ? w.replace(/(?:ing|ed)$/, "") : w.length > 4 && /es$/.test(w) && !/(?:ses|ches|shes|xes)$/.test(w) ? w.slice(0, -1) : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
export const contentTokens = (text) => [...new Set((String(text).toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem))];

/** { text, added }: the query with the statutory words of every rule whose `when` word occurs in it appended. rules: [{ when: [word], add: "words" }]. */
export function expandQuery(q, rules = []) {
  const have = new Set(contentTokens(q)), added = [];
  for (const r of rules) if (r.when.some((w) => have.has(stem(w.toLowerCase())) || have.has(w.toLowerCase()))) for (const w of contentTokens(r.add)) if (!have.has(w) && !added.includes(w)) added.push(w);
  return { text: added.length ? `${q} ${rules.filter((r) => r.when.some((w) => have.has(stem(w.toLowerCase())) || have.has(w.toLowerCase()))).map((r) => r.add).join(" ")}` : q, added };
}

const share = (tokens, text) => { if (!tokens.length) return 0; const have = new Set(contentTokens(text)); return tokens.filter((t) => have.has(t)).length / tokens.length; };
/** A multiplier of 1 to 1.35 for a section whose heading and opening use the query's own words: a section about the thing asked beats one that is only close in meaning. tokens: contentTokens of the (expanded) query. */
export const lexicalBoost = (tokens, heading, lead) => 1 + 0.35 * (0.6 * share(tokens, heading ?? "") + 0.4 * share(tokens, lead ?? ""));

/** Keys in final order: `semantic` (best first) keeps its order, except that a key which `keyword` hits (best first) also found moves up: 3 places for a top-3 keyword hit, 2 for the top 10, 1 for the top 20. Keyword hits that
 *  meaning did not find are ignored, and a tie goes to the meaning order: keywords lift a result, they never overturn the order or add results of their own. */
export function hybridOrder(semantic, keyword) {
  const kwRank = new Map(keyword.map((k, i) => [k, i])), lift = (k) => { const r = kwRank.get(k); return r === undefined ? 0 : r < 3 ? 3 : r < 10 ? 2 : r < 20 ? 1 : 0; };
  return semantic.map((k, i) => ({ k, i, at: i - lift(k) })).sort((a, b) => a.at - b.at || a.i - b.i).map((x) => x.k);
}

/** The meaningful words of a text, lower case, NOT stemmed (the database stems them itself): for a keyword query. */
export const contentWords = (text) => [...new Set((String(text).toLowerCase().match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w)))];
