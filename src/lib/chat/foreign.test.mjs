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
test("comparison and mixed questions that name an Indian side are answered from our sources, the foreign law only as context (12 examples, with and without the word India)", () => {
  for (const q of [
    "How does India's DPDP Act differ from GDPR?", "Is Indian defamation law based on English law?", "Which US cases has the Indian Supreme Court cited on privacy?",
    "How does the DPDP Act differ from GDPR?", "Compare the Consumer Protection Act 2019 with the UK Consumer Rights Act 2015", "Is the Information Technology Act similar to the US Patriot Act?",
    "Which English cases did the Supreme Court follow on negligence?", "What does Section 124A say and how does it compare to the First Amendment?", "Does our contract law follow the English rule in Hadley v Baxendale?",
    "Is section 302 BNS borrowed from UK law?", "Who is liable under the POSH Act and how does it differ from Title VII?", "Is Article 21 of the Constitution wider than the US due process clause?",
  ]) assert.equal(foreignLaw(q), null, q);
});
test("an Indian-sounding Act name does not hide a question about the same-named foreign Act", () => {
  for (const q of ["What does the UK Companies Act 2006 require of directors?", "What does the US Copyright Act say about fair use?", "What does the Singapore Companies Act say about directors?", "What did the US Supreme Court decide in Miranda v Arizona?"]) assert.ok(foreignLaw(q), q);
});
test("class: a foreign-law answer is 'not found' even when its related-provision paragraph cites a section (Oct 31 run: q126 scored 0 for this)", () => {
  const info = foreignLaw("What did the US Supreme Court decide in Miranda v. Arizona about police questioning?"), sources = [{ n: 7 }];
  const long = `${RELATED_LABEL} Section 182 of the Bharatiya Nagarik Suraksha Sanhita, 2023 states that no police officer or other person in authority shall offer or make any inducement, threat, or promise as mentioned in section 22 of the Bharatiya Sakshya Adhiniyam, 2023, but no police officer or other person shall prevent any person from making any statement of their own free will in the course of an investigation [7].`;
  const out = enforceForeign(`x\n\n${long}`, info, sources);
  assert.ok(out.includes("[7]") && out.split(/\s+/).length > 70);
  assert.equal(detectNotFound(out), true);
  assert.equal(detectNotFound("I couldn't find the exact section, but section 5 says the penalty is two years [1]. " + "word ".repeat(80)), false);   // an ordinary long cited answer is still the checker's job
});
test("class: a foreign-law answer is never touched by the held-section 'not found' claim remover (it would delete the required first sentence)", () => {
  const r = fs.readFileSync("src/app/api/chat/route.ts", "utf8");
  assert.match(r, /tidyChips\(foreign \? clean\.text : dropNotFoundClaims\(/);
  assert.ok(r.indexOf("enforceForeign(clean.text, foreign") < r.indexOf("dropGapRepeats("));
});
