// Merging ranked result lists and scoring a search against known answers. PURE logic (used by the bake-off scripts now, by the search route later).

/** Reciprocal rank fusion: score(item) = sum over lists of 1 / (k + rank), rank starting at 1. lists: arrays of string keys, best first. Returns keys, best first. */
export function rrf(lists, k = 60) {
  const score = new Map();
  for (const list of lists) list.forEach((key, i) => score.set(key, (score.get(key) ?? 0) + 1 / (k + i + 1)));
  return [...score.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([key]) => key);
}

/** First key of `list` seen once, keeping order: chunks -> sections. */
export const dedupe = (list) => [...new Set(list)];

/** 1-based rank of the first key that is in `gold` (a Set), or null. */
export function firstHitRank(list, gold) { const i = list.findIndex((k) => gold.has(k)); return i < 0 ? null : i + 1; }

/** results: [{ rank: number | null }] -> share of questions answered within top K. */
export function hitRates(ranks, ks = [1, 5, 10]) {
  const out = {};
  for (const k of ks) out[k] = ranks.filter((r) => r !== null && r <= k).length / ranks.length;
  return out;
}

/** Truncate a vector to its first `dim` values and renormalise to unit length (Matryoshka embeddings: matches the API's native lower dimension). */
export function truncateNormalize(vec, dim) {
  const v = Array.from(vec.slice(0, dim)); let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}
