import test from "node:test";
import assert from "node:assert/strict";
import { contentTokens, expandQuery, hybridOrder, lexicalBoost, stem } from "./searchBoost.mjs";
import rules from "../../config/search-synonyms.json" with { type: "json" };

test("words are trimmed to a stem so plurals and endings match", () => {
  assert.equal(stem("cheques"), "cheque"); assert.equal(stem("bounced"), "bounc"); assert.equal(stem("bounces"), "bounce"); assert.equal(stem("notice"), "notice"); assert.equal(stem("class"), "class");
  assert.deepEqual(contentTokens("What is the notice after cheque bounces?"), ["notice", "cheque", "bounce"]);
});
test("everyday words get their statutory words appended; other queries are untouched", () => {
  const e = expandQuery("notice after cheque bounces", rules.rules);
  assert.match(e.text, /^notice after cheque bounces dishonour of cheque for insufficiency of funds$/); assert.ok(e.added.includes("dishonour") && e.added.includes("insufficiency"));
  assert.deepEqual(expandQuery("punishment for murder", rules.rules), { text: "punishment for murder", added: [] });
  assert.ok(expandQuery("my landlord wants to evict me", rules.rules).added.includes("lessor"));
});
test("a section about the thing asked beats one that is only close in meaning", () => {
  const tokens = contentTokens(expandQuery("notice after cheque bounces", rules.rules).text);
  const s138 = lexicalBoost(tokens, "Dishonour of cheque for insufficiency, etc., of funds in the account", "Where any cheque drawn by a person on an account maintained by him with a banker is returned by the bank unpaid, because of insufficiency of funds, such person shall be deemed to have committed an offence");
  const s106 = lexicalBoost(tokens, "Reasonable time of giving notice of dishonour", "Reasonable time of giving notice of dishonour.— If the holder and the party to whom notice of dishonour is given carry on business");
  const s93 = lexicalBoost(tokens, "By and to whom notice should be given", "When a promissory note, bill of exchange or cheque is dishonoured by non-acceptance or non-payment, the holder thereof must give notice");
  assert.ok(s138 > s106 && s138 > s93, `${s138} ${s106} ${s93}`); assert.ok(s138 <= 1.35 && s106 >= 1);
  assert.equal(lexicalBoost([], "x", "y"), 1);
});
test("keyword hits lift a result a little but never overturn the meaning order or add results of their own", () => {
  assert.deepEqual(hybridOrder(["a", "b", "c", "d", "e"], ["d"]), ["a", "d", "b", "c", "e"]);   // d moves up 3 places, tied with a: the meaning order wins the tie
  assert.deepEqual(hybridOrder(["a", "b", "c", "d", "e", "f", "g"], ["g"]), ["a", "b", "c", "d", "g", "e", "f"]);   // 3 places at most, and a tie goes to the meaning order
  assert.equal(hybridOrder(["a", "b", "c"], ["x", "y"]).length, 3);          // keyword-only hits are ignored
  assert.deepEqual(hybridOrder(["a", "b"], []), ["a", "b"]);
  assert.equal(hybridOrder(["a", "b", "c", "d", "e", "f"], ["f", "e"])[0], "a");   // two keyword hits near the bottom do not reach the top
});
