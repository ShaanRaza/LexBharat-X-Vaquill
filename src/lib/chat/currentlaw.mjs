// "Answer from the current law": when sections of a repealed law AND of the law that replaced it were both retrieved, the replacement goes first, the old section is marked as replaced, and the
// prompt tells the model to answer from the current law and name the old one as "previously ...". PURE logic; the pairs of laws are data (src/config/replaced-laws.json).

/** The pair whose old Act this title belongs to, or null. Titles are compared in lower case from the start ("The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)"). */
// an amending Act of the same name ("The Code of Criminal Procedure (Amendment) Act, 2005") is its own Act, not the repealed code
export const pairFor = (title, pairs) => { const t = String(title).toLowerCase().trim(); return pairs.find((p) => t.startsWith(p.old) && !/^[\s,(]*(?:\(\s*)?(?:amendment|amending|second|third)\b/.test(t.slice(p.old.length))) ?? null; };
const isNew = (title, pair) => String(title).toLowerCase().trim().startsWith(pair.new);

/** hits: the picked hits [{ actTitle, actStatus }] in rank order; all: every candidate (a superset, rank order); k: how many may be returned.
 *  Returns the hits for the prompt: (1) if a picked hit belongs to a repealed Act with a known replacement, up to `want` in-force hits of that replacement are added from `all` when missing;
 *  (2) when a replacement is present, hits of the old Act move after the rest and carry `replacedBy` (the replacement's label). Nothing changes when no pair is involved. */
export function currentLawFirst(hits, all, pairs, { k = 10, want = 2, keyOf = (h) => `${h.actId}|${h.sectionKey}` } = {}) {
  const oldPairs = [...new Set(hits.filter((h) => h.actStatus !== "in_force").map((h) => pairFor(h.actTitle, pairs)).filter(Boolean))];
  if (!oldPairs.length) return hits;
  let out = [...hits];
  for (const p of oldPairs) {
    const have = out.filter((h) => h.actStatus === "in_force" && isNew(h.actTitle, p)).length;
    if (have >= want) continue;
    const seen = new Set(out.map(keyOf));
    out.push(...all.filter((h) => h.actStatus === "in_force" && isNew(h.actTitle, p) && !seen.has(keyOf(h))).slice(0, want - have));
  }
  const replaced = new Map();   // old pair -> label, only where the replacement is present
  for (const p of oldPairs) if (out.some((h) => h.actStatus === "in_force" && isNew(h.actTitle, p))) replaced.set(p, p.label ?? p.new);
  if (!replaced.size) return hits;
  const marked = out.map((h) => { const p = h.actStatus !== "in_force" ? pairFor(h.actTitle, [...replaced.keys()]) : null; return p ? { ...h, replacedBy: replaced.get(p) } : h; });
  const keep = marked.filter((h) => !h.replacedBy), old = marked.filter((h) => h.replacedBy);
  // the old sections stay available as sources (the answer may mention them), after the current law; the new-law extras must not push out everything else
  return [...keep, ...old].slice(0, Math.max(k, hits.length));
}

/** Added to the system prompt when a source is marked as replaced. */
export const REPLACED_ADDENDUM = `

Some sources are marked "not in force; replaced by ..." (a repealed law). Extra rules for them:
- Answer from the CURRENT law: the source of the law that replaced it. Do not answer from the repealed text when its replacement is among the sources.
- Then mention the old provision in one short phrase, for example "previously Section 379 of the Indian Penal Code" (cite the old source too). Do not repeat its full content.
- If the question names the old section (for example "IPC 302"), say that it has been replaced and give the current section.`;
