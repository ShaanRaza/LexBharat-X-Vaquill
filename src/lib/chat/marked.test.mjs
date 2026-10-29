import test from "node:test";
import assert from "node:assert/strict";
import { sentencesCiting, paragraphsOf, markParagraph } from "./marked.mjs";

const ANSWER = "The payee must give written notice within thirty days of the bank's return memo [1]. The drawer then has fifteen days to pay [1][2].\n- A complaint follows within one month [2].";
test("sentencesCiting returns the sentences that cite one source, without the marks", () => {
  assert.deepEqual(sentencesCiting(ANSWER, 1), ["The payee must give written notice within thirty days of the bank's return memo .", "The drawer then has fifteen days to pay ."].map((s) => s.replace(" .", ".")));
  assert.deepEqual(sentencesCiting(ANSWER, 2).length, 2); assert.deepEqual(sentencesCiting(ANSWER, 3), []);
});
test("paragraphsOf drops markdown marks and empty lines", () => { assert.deepEqual(paragraphsOf("**138. Dishonour**\n\n> (a) the cheque is _presented_\n(b) notice"), ["138. Dishonour", "(a) the cheque is presented", "(b) notice"]); });
const SECTION = "138. Dishonour of cheque for insufficiency of funds\nWhere any cheque is returned by the bank unpaid, the drawer shall be punished.\n(b) the payee makes a demand for the payment by giving a notice in writing to the drawer within thirty days of the receipt of information from the bank regarding the return of the cheque as unpaid; and\n(c) the drawer fails to make the payment within fifteen days of the receipt of the said notice.";
test("the marked paragraph is the one the citing sentences share the most words with", () => {
  assert.equal(markParagraph(SECTION, ["The payee must give written notice within thirty days of the bank's return memo."]).marked, 2);
  assert.equal(markParagraph(SECTION, ["The drawer then has fifteen days to pay."]).marked, 3);
});
test("nothing is marked when no paragraph clearly matches", () => { assert.equal(markParagraph(SECTION, ["Completely unrelated gardening advice."]).marked, -1); assert.equal(markParagraph("", ["anything at all here"]).marked, -1); });
