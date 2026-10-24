// Keyword ranking of passages, the fallback when the meaning-based search is unavailable (no embeddings yet, or Voyage busy). PURE logic.
const STOP = new Set("the of and or to a an in on for is are be this that with as by at from it its under shall may not any what which who when how can does do i my our their there into than then also such".split(" "));
export const terms = (s) => [...new Set(String(s).toLowerCase().replace(/[^a-z0-9₹ ]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)))];
const stem = (w) => w.replace(/(ing|ed|es|s)$/, "");
/** Ranks passages [{ body, label }] by how many (stemmed) query terms they contain, rarer terms counting more. Returns the best k with score > 0, best first. */
export function lexicalRank(query, passages, k = 5) {
  const q = terms(query).map(stem); if (!q.length) return [];
  const toks = passages.map((p) => new Set(terms(`${p.label ?? ""} ${p.body}`).map(stem)));
  const df = q.map((t) => toks.filter((s) => s.has(t)).length);
  return passages.map((p, i) => ({ p, score: q.reduce((a, t, j) => a + (toks[i].has(t) ? 1 + Math.log((passages.length + 1) / (df[j] + 1)) : 0), 0) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k).map((x) => x.p);
}
