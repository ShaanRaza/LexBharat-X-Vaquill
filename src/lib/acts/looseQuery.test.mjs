import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { looseTerms, looseTermsFor, looseTsQuery, wantsStrict, LOOSE_BELOW } from "./looseQuery.mjs";

test("filler words are dropped, the rest are ORed", () => {
  assert.equal(looseTsQuery("what is the notice period after a cheque bounces"), "notice | period | cheque | bounces");
  assert.equal(looseTsQuery("tenant not paying rent what can landlord do"), "tenant | paying | rent | landlord");
  assert.equal(looseTsQuery("punishment for stealing"), "punishment | stealing");
});
test("only letters and digits reach the database query (no operators can be injected)", () => {
  assert.equal(looseTsQuery("cheque & notice | (bounce) :* ; drop table"), "cheque | notice | bounce | drop | table");
  for (const t of looseTerms("a' || '1'='1 --  <script>x</script>")) assert.match(t, /^[a-z0-9]+$/);
});
test("a quoted phrase, an operator, or a single word is never loosened", () => {
  assert.equal(looseTsQuery('"cheque bounce" notice'), "");
  assert.equal(looseTsQuery("cheque -notice"), "");
  assert.equal(looseTsQuery("cheque"), "");
  assert.equal(looseTsQuery("the of and"), "");
  assert.equal(wantsStrict("bail OR remand"), true);
});
test("at most ten terms, no repeats", () => {
  assert.equal(looseTerms("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu alpha").length, 10);
  assert.deepEqual(looseTerms("rent rent RENT"), ["rent"]);
});

test("looseTermsFor: when a strict search is loosened, and with which words", () => {
  const sentence = "what is the notice period after a cheque bounces";
  assert.deepEqual(looseTermsFor(sentence, 0), ["notice", "period", "cheque", "bounces"]);
  assert.ok(looseTermsFor(sentence, 40), "a long question is loosened even when the strict search found many");
  assert.equal(looseTermsFor(sentence, 40, { sentence: false }), null);
  assert.equal(looseTermsFor("anticipatory bail", 40), null);                   // a short search with plenty of strict results stays strict
  assert.deepEqual(looseTermsFor("anticipatory bail", 0), ["anticipatory", "bail"]);
  assert.equal(looseTermsFor("cheque notice", LOOSE_BELOW - 1), null);          // two words and some results: nothing to loosen
  assert.equal(looseTermsFor('"cheque bounce" notice period after', 0), null); // a quoted phrase is never loosened
  assert.deepEqual(looseTermsFor("bounced cheque", 0, { expand: (q) => q + " dishonour" }), ["bounced", "cheque", "dishonour"]);
});

// ---- the class: every keyword path that requires all the words can also search with some of them ----
const SRC = ["src/lib/acts/searchStore.ts", "src/lib/acts/regSearch.ts", "src/lib/judgments/scText.ts"];
test("class: every keyword search over Acts, regulators and judgments has the loose fallback (looseTermsFor)", () => {
  const missing = SRC.filter((f) => { const t = fs.readFileSync(f, "utf8"); return /websearch_to_tsquery/.test(t) && !/looseTermsFor\(/.test(t); });
  assert.deepEqual(missing, []);
});
test("class: Ask's judgment passages have a word-search fallback, and Ask's hybrid keyword pass is the one place that stays strict", () => {
  const r = fs.readFileSync("src/lib/chat/retrieve.ts", "utf8");
  assert.match(r, /searchJudgmentsByWords\(question/);
  assert.match(r, /exact: true, loose: false/);
});
