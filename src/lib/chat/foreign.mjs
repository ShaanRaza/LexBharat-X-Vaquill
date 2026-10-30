// Questions about FOREIGN law (a foreign court, case, statute or legal system). PURE logic. Our sources are Indian Acts and Indian Supreme Court judgments, so such a question cannot be answered from them.
// The answer must (1) say first "I couldn't find this in the sources.", (2) may then point to the closest Indian provision, clearly labelled as related and NOT as the answer, and (3) never describe the foreign case or law
// from memory or from loosely related excerpts (an Indian judgment that mentions a foreign case does not tell us what that case decided). The lists are data: src/config/foreign-law.json.
import cfg from "../../config/foreign-law.json" with { type: "json" };

const compile = (list) => list.map((p) => new RegExp(p, "i"));
const INDIAN = compile(cfg.indian), FOREIGN = [...compile(cfg.jurisdictions), ...compile(cfg.courts_and_statutes)], CASES = compile(cfg.cases);

/** { terms: [the words of the question that name the foreign thing] } when the question is about foreign law, else null. A question that also names India or an Indian law or court is not foreign. */
export function foreignLaw(question) {
  const q = String(question ?? "");
  const terms = [...CASES, ...FOREIGN].map((re) => re.exec(q)?.[0]).filter(Boolean);
  if (!terms.length) return null;
  if (INDIAN.some((re) => re.test(q))) return null;   // a question that also names India, an Indian law or an Indian court ("Is the US Miranda rule followed in India?") is an Indian-law question
  return { terms: [...new Set(terms.map((t) => t.trim()))] };
}

export const FOREIGN_FIRST = "I couldn't find this in the sources.";
export const RELATED_LABEL = "Related Indian provision (not an answer to your question):";

/** Added to the system prompt for a foreign-law question. */
export const FOREIGN_ADDENDUM = `

This question is about FOREIGN law (a foreign court, case, statute or legal system). Our sources are Indian Acts and Indian Supreme Court judgments; they do not contain it. Extra rules:
- Begin the answer with exactly: "${FOREIGN_FIRST}"
- Do NOT describe the foreign case, statute or rule, not from memory and not from the sources. A source that merely mentions a foreign case does not tell you what it decided.
- You may then add ONE short paragraph that begins "${RELATED_LABEL}" and names the closest Indian provision among the numbered sources, with its citation. Say only what that Indian provision says. If no source is close, add nothing.`;

/** The first paragraph that starts with the related label and then states something: { text } or null. */
function relatedParagraph(answer) {
  const lines = String(answer).split(/\n+/).map((l) => l.trim());
  const i = lines.findIndex((l) => /^(?:[-*]\s*)?related indian provision/i.test(l));
  if (i < 0) return null;
  const body = lines[i].replace(/^(?:[-*]\s*)?related indian provision[^:]*:\s*/i, "") || lines[i + 1] || "";
  return body.trim() || null;
}

/** The answer a foreign-law question gets: the not-found line, and at most one related Indian provision (kept only when it cites an Act section and does not name the foreign thing). Everything else the model wrote is dropped,
 *  because it can only be a description of the foreign law from memory or from excerpts. sources: [{ n, kind }]. */
export function enforceForeign(answer, info, sources = []) {
  const by = new Map(sources.map((s) => [s.n, s]));
  let rel = relatedParagraph(answer);
  if (rel) {
    const cited = [...rel.matchAll(/\[(\d{1,2})\]/g)].map((m) => by.get(Number(m[1]))).filter(Boolean);
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const names = info.terms.some((t) => new RegExp(`\\b${esc(t)}\\b`, t.length <= 3 ? "" : "i").test(rel));   // the foreign thing's own words, whole words (a 2-3 letter term such as "US" only as written)
    if (!cited.some((s) => s.kind !== "judgment" && s.kind !== "doc") || names || rel.length > 600) rel = null;
  }
  const first = `${FOREIGN_FIRST} Our sources are Indian Acts and Indian Supreme Court judgments, so they do not cover the foreign law or case you asked about.`;
  return rel ? `${first}\n\n${RELATED_LABEL} ${rel}` : first;
}
