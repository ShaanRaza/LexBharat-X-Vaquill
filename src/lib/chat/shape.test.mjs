import test from "node:test";
import assert from "node:assert/strict";
import { answerFirst, dedupeCitations, openingHedge, relatedOnlyIfApplicable } from "./shape.mjs";
import { expandQuery } from "../acts/searchBoost.mjs";
import rules from "../../config/search-synonyms.json" with { type: "json" };

test("a hedge before the answer is dropped; a 'could not find' before the answer moves to the end", () => {
  assert.equal(answerFirst("Based on the sources provided, the notice must be sent within 30 days [1]."), "The notice must be sent within 30 days [1].");
  assert.equal(answerFirst("It appears that the notice must be sent within 30 days [1]."), "The notice must be sent within 30 days [1].");
  assert.equal(answerFirst("I couldn't find the exact form of the notice. However, the notice must be sent within 30 days [1]."), "The notice must be sent within 30 days [1].\n\nI couldn't find the exact form of the notice.");
  assert.equal(answerFirst("The notice must be sent within 30 days [1]."), "The notice must be sent within 30 days [1].");   // nothing to move
  assert.equal(answerFirst("I couldn't find any section about this."), "I couldn't find any section about this.");           // a real not-found answer stays as it is
  assert.equal(openingHedge("The notice must be sent within 30 days [1]."), null);
});
const sources = [
  { n: 1, number: "138", heading: "Dishonour of cheque for insufficiency, etc., of funds in the account", text: "Where any cheque drawn by a person on an account maintained by him with a banker is returned by the bank unpaid, because of insufficiency of funds, such person shall be deemed to have committed an offence" },
  { n: 2, number: "142", heading: "Cognizance of offences", text: "no court shall take cognizance of any offence punishable under section 138 except upon a complaint, in writing, made by the payee ... of the cheque ... notice" },
  { n: 3, number: "106", heading: "Reasonable time of giving notice of dishonour", text: "If the holder and the party to whom notice of dishonour is given carry on business or live in different places" },
  { n: 4, number: "94", heading: "By and to whom notice should be given", text: "When a promissory note, bill of exchange is dishonoured by non-acceptance, the holder must give notice of dishonour" },
];
test("'Related provisions' keep only sections that apply to the question (cheque, notice, bounce)", () => {
  const q = expandQuery("notice period for cheque bounce", rules.rules).text;
  const a = "The notice must be sent within 30 days [1].\n\nRelated provisions:\n- Section 142 covers cognizance of the complaint [2].\n- Section 106 covers the reasonable time of giving notice of dishonour [3].\n- Section 94 covers notice of dishonour [4].\n\nDone.";
  const out = relatedOnlyIfApplicable(a, sources, q);
  assert.match(out, /Section 142/); assert.doesNotMatch(out, /Section 106|Section 94/); assert.match(out, /Done\.$/);
});
test("when no related bullet applies the whole 'Related provisions' line goes; unreadable or uncited bullets stay", () => {
  const q = expandQuery("notice period for cheque bounce", rules.rules).text;
  assert.equal(relatedOnlyIfApplicable("Answer [1].\n\nRelated provisions:\n- Section 106 about notice [3].\n- Section 94 about notice [4].", sources, q), "Answer [1].");
  assert.match(relatedOnlyIfApplicable("Answer [1].\nRelated provisions:\n- Something uncited.\n- Unknown source [9].", sources, q), /Something uncited[\s\S]*Unknown source/);
  assert.equal(relatedOnlyIfApplicable("No related line here [1].", sources, q), "No related line here [1].");
});
test("a citation repeated inside one sentence shows once; the same number in another sentence is untouched", () => {
  assert.equal(dedupeCitations("The notice is due in 30 days [1][1]. The payment is due in 15 days [1]."), "The notice is due in 30 days [1]. The payment is due in 15 days [1].");
  assert.equal(dedupeCitations("The notice [1] must be sent in 30 days [1]."), "The notice [1] must be sent in 30 days.");
  assert.equal(dedupeCitations("Both apply [1, 2][2]."), "Both apply [1, 2].");
  assert.equal(dedupeCitations("- first [1]\n- second [1]"), "- first [1]\n- second [1]");
});
