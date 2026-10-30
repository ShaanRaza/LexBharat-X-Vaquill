// A question about FOREIGN law: "I couldn't find this in the sources" first, at most one related Indian provision (labelled), never a description of the foreign law. General rules; several different foreign examples.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { foreignLaw, enforceForeign, FOREIGN_FIRST, RELATED_LABEL, FOREIGN_ADDENDUM } from "./foreign.mjs";
import { detectNotFound, buildChatPrompt } from "./prompt.mjs";
import { NOT_FOUND_FIRST } from "./shape.mjs";

const FOREIGN_EXAMPLES = [
  ["What did the US Supreme Court decide in Miranda v. Arizona about police questioning?", "Miranda was decided by the US Supreme Court: suspects must be warned of the right to silence [3]."],
  ["What are the data protection duties of a company under the EU GDPR?", "The GDPR requires a lawful basis, data protection officers and breach notification within 72 hours."],
  ["How does the UK Consumer Rights Act 2015 treat faulty goods?", "Under the Consumer Rights Act 2015 goods must be of satisfactory quality and a consumer has a 30-day right to reject."],
  ["What does the First Amendment to the US Constitution protect?", "It protects freedom of speech, religion and the press [2]."],
  ["Explain the rule in Donoghue v Stevenson.", "The manufacturer owes a duty of care to the ultimate consumer, the neighbour principle."],
  ["Are non-compete clauses enforceable in California?", "California voids most non-compete agreements by statute."],
];
test("foreign-law questions are recognised, by kind (court, statute, amendment, case, jurisdiction, regulation), not by one case", () => {
  for (const [q] of FOREIGN_EXAMPLES) assert.ok(foreignLaw(q), q);
  assert.ok(foreignLaw("What did the US Supreme Court decide in Miranda v. Arizona about police questioning?").terms.includes("Miranda v. Arizona"));
});
test("an Indian-law question, or a question that also names India, is not treated as foreign", () => {
  for (const q of ["Is the Miranda rule followed in India?", "What is the punishment for theft under the BNS?", "Does the Indian Contract Act follow English law on minors?", "Can I sue in a Singapore court for a debt owed by an Indian company?", "What is the current RBI repo rate?", "What is the penalty under the Zorgian Space Resources Act, 2040?", "When can an accused be released on bail?"]) assert.equal(foreignLaw(q), null, q);
});
test("the answer to a foreign-law question starts with 'I couldn't find this in the sources' and never describes the foreign law (6 different examples)", () => {
  const sources = [{ n: 1, kind: undefined }, { n: 2, kind: "judgment" }, { n: 3, kind: "judgment" }];
  for (const [q, modelAnswer] of FOREIGN_EXAMPLES) {
    const out = enforceForeign(modelAnswer, foreignLaw(q), sources);
    assert.ok(out.startsWith(FOREIGN_FIRST), q); assert.match(out, NOT_FOUND_FIRST); assert.equal(detectNotFound(out), true, q);
    for (const word of ["warned", "72 hours", "30-day", "freedom of speech", "neighbour", "voids"]) assert.ok(!out.includes(word), `${q}: the model's description of the foreign law must be dropped (${word})`);
  }
});
test("one related Indian provision may follow, labelled, only if it cites an Act section and does not name the foreign thing", () => {
  const info = foreignLaw("What did the US Supreme Court decide in Miranda v. Arizona about police questioning?"), sources = [{ n: 1 }, { n: 2, kind: "judgment" }];
  const good = `I couldn't find this in the sources.\n\n${RELATED_LABEL} Article 20(3) of the Constitution of India says no person accused of an offence shall be compelled to be a witness against himself [1].`;
  assert.match(enforceForeign(good, info, sources), new RegExp(`${RELATED_LABEL.replace(/[()]/g, "\\$&")} Article 20\\(3\\)`));
  assert.ok(!enforceForeign(`${RELATED_LABEL} In Miranda v. Arizona the court held that suspects must be warned [1].`, info, sources).includes("Related Indian provision"));   // names the foreign case
  assert.ok(!enforceForeign(`${RELATED_LABEL} A judgment excerpt discusses police questioning [2].`, info, sources).includes("Related Indian provision"));   // cites only a judgment excerpt
  assert.ok(!enforceForeign(`${RELATED_LABEL} Section 180 of the BNSS covers examination by police.`, info, sources).includes("Related Indian provision"));   // cites nothing
  assert.equal(enforceForeign("anything", info, []).split("\n").length, 1);
});
test("the prompt for a foreign-law question carries the rule; other prompts do not", () => {
  const base = { question: "q", sources: [{ n: 1, actTitle: "The Constitution of India", number: "20", heading: "x", text: "t", year: 1950, inForce: true }] };
  assert.match(buildChatPrompt({ ...base, foreign: true }).system, /FOREIGN law/); assert.match(FOREIGN_ADDENDUM, /Do NOT describe the foreign case/);
  assert.ok(!buildChatPrompt(base).system.includes("FOREIGN law"));
});
test("class: the chat route enforces the rule on every foreign-law answer", () => {
  const r = fs.readFileSync("src/app/api/chat/route.ts", "utf8");
  assert.match(r, /foreignLaw\(message\)/); assert.match(r, /enforceForeign\(clean\.text, foreign/); assert.match(r, /foreign: !!foreign/);
});
