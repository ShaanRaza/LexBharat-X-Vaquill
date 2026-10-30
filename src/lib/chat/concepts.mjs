// Everyday words -> the Acts that usually answer them. PURE logic; the hints are DATA (src/config/concept-acts.json, one entry per area of law, not per question).
// Two uses: (1) the query rewrite is told which Acts usually apply, (2) retrieval always gets one query that names the likely Act, so a section is found even when it never uses the user's words.
import cfg from "../../config/concept-acts.json" with { type: "json" };
import { stem } from "../acts/searchBoost.mjs";
import { namesAct } from "./share.mjs";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9\s-]+/g, " ").replace(/\s+/g, " ").trim();
function has(text, tokens, w) {
  const x = norm(w);
  if (/[\s]/.test(x)) return ` ${text} `.includes(` ${x} `);
  return tokens.has(x) || tokens.has(stem(x));
}
/** The concepts whose words occur in the question, best first: [{ id, area, act, query, hits }]. An entry needs one of its `when` words and, when it lists `all`, one of those too. */
export function conceptMatches(question, concepts = cfg.concepts, max = 3) {
  const text = norm(question), tokens = new Set(text.split(" ").flatMap((w) => [w, stem(w)]));
  const out = [];
  for (const c of concepts) {
    const hits = c.when.filter((w) => has(text, tokens, w)).length;
    if (!hits) continue;
    if (c.all?.length && !c.all.some((w) => has(text, tokens, w))) continue;
    out.push({ id: c.id, area: c.area, act: c.act, query: c.query, hits, hintOnly: !!c.hintOnly });
  }
  return out.sort((a, b) => b.hits - a.hits).slice(0, max);
}
/** Lines for the rewrite prompt: the Acts that usually apply to this kind of question (the model may use them or not). "" when nothing matches. */
export function conceptHint(question) {
  const m = conceptMatches(question);
  return m.length ? `Acts that usually apply to questions like this (use them if relevant, and name them in the queries): ${[...new Set(m.map((x) => x.act))].join("; ")}.` : "";
}
/** At most `max` search queries that name the likely Act, for retrieval. A query is added only for an Act that NO existing query already names (`existing`: the question and the rewrite's queries), and never for a hint-only concept: a one-Act question keeps the search it had. */
export const conceptQueries = (question, max = 2, existing = []) => conceptMatches(question, cfg.concepts, 6).filter((c) => !c.hintOnly && !existing.some((q) => namesAct(q, c.act))).slice(0, max).map((c) => c.query);
