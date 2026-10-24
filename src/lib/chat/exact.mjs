// When a question names an exact provision, keep it first and drop sources from unrelated Acts. PURE logic.
/** hits: ranked hits [{ actId, ... }]; exactKeys: keys of the units the question named; keyOf(hit) -> key. Returns the exact units first (in the order named), then up to `extra` other hits of the same Acts (neighbours), in rank order. */
export function narrowToExact(hits, exactKeys, keyOf, extra = 3) {
  const byKey = new Map(hits.map((h) => [keyOf(h), h])), first = exactKeys.map((k) => byKey.get(k)).filter(Boolean);
  if (!first.length) return hits;
  const acts = new Set(first.map((h) => h.actId));
  const rest = hits.filter((h) => !exactKeys.includes(keyOf(h)) && acts.has(h.actId)).slice(0, extra);
  return [...first, ...rest];
}
