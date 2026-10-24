// The saved review as simple blocks for the .docx and PDF export (same block shapes as src/lib/drafting/docmodel.mjs: heading, p, list). PURE logic.
import { NOT_LEGAL_ADVICE, RISKS } from "./prompts.mjs";
import { CONTRACT_TYPES } from "./rules.mjs";

const r = (text, o = {}) => ({ text, ...o });
const H = (t, level = 2) => ({ type: "heading", level, runs: [r(t, { bold: true })] });
const P = (...runs) => ({ type: "p", runs: runs.map((x) => (typeof x === "string" ? r(x) : x)) });
const L = (items) => ({ type: "list", ordered: false, start: 1, items });
const RISK = { low: "Low", medium: "Medium", high: "High" };
const sec = (c) => `${c.actTitle.replace(/^the\s+/i, "")}${c.number ? `, Section ${c.number}` : ""}`;

export function reviewToBlocks(run) {
  const res = run.result ?? {}, sum = res.summary?.value, blocks = [];
  blocks.push(H(`Contract review: ${run.docName}`, 1));
  blocks.push(P(r(`Review for a qualified lawyer to confirm. Not legal advice.`, { italics: true })));
  blocks.push(P(`Contract type: ${CONTRACT_TYPES[run.contractType]?.label ?? run.contractType}. Reviewed for: ${run.side}.`));
  blocks.push(H("Summary"));
  if (sum) {
    blocks.push(P(sum.what));
    blocks.push(L([[r("Parties: ", { bold: true }), r(sum.parties.join("; ") || "not stated")], [r("Term: ", { bold: true }), r(sum.term)], [r("Money: ", { bold: true }), r(sum.money)], [r("Governing law: ", { bold: true }), r(sum.governingLaw)],
      [r("Overall risk: ", { bold: true }), r(`${RISK[res.risk] ?? "not assessed"}${sum.overallWhy ? `. ${sum.overallWhy}` : ""}`)]]));
  } else blocks.push(P(`The summary could not be prepared.${res.risk ? ` Overall risk from the clause results: ${RISK[res.risk]}.` : ""}`));
  const clauses = (res.parts ?? []).flatMap((p) => p.clauses ?? []);
  blocks.push(H("Clauses"));
  const failed = (res.parts ?? []).filter((p) => p.status === "failed");
  if (failed.length) blocks.push(P(r(`Part${failed.length > 1 ? "s" : ""} ${failed.map((p) => p.i + 1).join(", ")} of the contract were not reviewed. Retry them in the app.`, { bold: true })));
  blocks.push(L(clauses.map((c) => [r(`${c.ref} — ${RISKS[c.risk]}. `, { bold: true }), r(c.reason), ...(c.quote ? [r(` Quote: “${c.quote}”`, { italics: true })] : [])])));
  const changes = clauses.filter((c) => c.change);
  blocks.push(H("Suggested changes"));
  if (changes.length) { for (const c of changes) { blocks.push(P(r(`Clause ${c.ref}`, { bold: true }))); blocks.push(P(r("Proposed wording: ", { bold: true }), r(c.change.wording))); blocks.push(P(r("Why: ", { bold: true }), r(c.change.why))); } } else blocks.push(P("No changes suggested."));
  blocks.push(H("Clauses usually found in this kind of contract that are missing"));
  blocks.push((res.missing ?? []).length ? L(res.missing.map((m) => [r(`${m.clause}. `, { bold: true }), r(m.why)])) : P("None found."));
  blocks.push(H("Indian law points"));
  const law = res.law ?? {};
  if (law.status === "failed") blocks.push(P(`The law points could not be prepared (${law.error ?? "error"}).`));
  else if (!(law.findings ?? []).length) blocks.push(P("No law points were supported by the sections found."));
  else {
    blocks.push(L(law.findings.map((f) => [r(`${f.topic}${f.clause ? ` (clause ${f.clause})` : ""}${f.severity === "check" ? " — to check" : ""}. `, { bold: true }), r(f.text)])));
    blocks.push(P(r("Sources used", { bold: true })));
    blocks.push(L((law.sources ?? []).filter((s) => law.findings.some((f) => f.cites.includes(s.n))).map((s) => [r(`[${s.n}] ${sec(s)}`)])));
  }
  return blocks;
}
export const reviewFileName = (run) => `Review-${String(run.docName).replace(/\.[A-Za-z0-9]+$/, "").replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 50) || "contract"}`;
export { NOT_LEGAL_ADVICE };
