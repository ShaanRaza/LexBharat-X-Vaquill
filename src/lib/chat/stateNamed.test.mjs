import test from "node:test";
import assert from "node:assert/strict";
import { extractLookups } from "../acts/lookups.mjs";
import { splitStates } from "../acts/semantic.mjs";
import { actMatcher } from "../acts/searchQuery.mjs";
import { gapSentence, heldAddendum, dropNotFoundClaims } from "./gaps.mjs";
import { buildChatPrompt } from "./prompt.mjs";

// a question that names a State and an Act: three different States and Acts, one rule
const CASES = [
  { q: "What does Section 34 of the Madhya Pradesh Indian Penal Code say?", state: "madhya-pradesh", rest: "Indian Penal Code", words: ["indian", "penal"], number: "34", actTitle: "The INDIAN-PENAL-CODE-1860", label: "Madhya Pradesh" },
  { q: "What does Section 7 of the Maharashtra Rent Control Act say?", state: "maharashtra", rest: "Rent Control Act", words: ["rent", "control"], number: "7", actTitle: "The Maharashtra Rent Control Act, 1999", label: "Maharashtra" },
  { q: "Explain Section 5 of the Tamil Nadu Shops and Establishments Act", state: "tamil-nadu", rest: "Shops and Establishments Act", words: ["shops", "establishments"], number: "5", actTitle: "The Tamil Nadu Shops and Establishments Act, 1947", label: "Tamil Nadu" },
  { q: "What is Section 61 of the Gujarat Land Revenue Code?", state: "gujarat", rest: "Land Revenue Code", words: ["land", "revenue"], number: "61", actTitle: "The Gujarat Land Revenue Code, 1879", label: "Gujarat" },
];
for (const c of CASES) {
  test(`state-named question: ${c.label}: the lookup names the State, the Act words are kept`, () => {
    const lk = extractLookups(c.q)[0];
    assert.ok(lk.startsWith(`${c.number} `), lk);
    const act = lk.replace(/^\S+\s+/, ""), { states, rest } = splitStates(act);
    assert.deepEqual([...states], [c.state]);
    assert.equal(rest.replace(/^the\s+/i, ""), c.rest);
    const w = actMatcher(rest, { noAlias: true });
    assert.equal(w.titlePrefix, null);                                  // a State copy is titled in its own way: its words are matched, never a title prefix
    for (const word of c.words) assert.ok(w.words.includes(word), word);
  });
  test(`state-named question: ${c.label}: when the copy holds the section the answer says so and never says not found`, () => {
    const held = [{ n: 1, number: c.number, actTitle: c.actTitle, state: c.state }];
    const add = heldAddendum(held);
    assert.match(add, /IS in the numbered sources/);
    assert.match(add, new RegExp(`${c.label} version of the`));
    assert.match(add, /Never say it was not found/);
    assert.ok(buildChatPrompt({ question: c.q, sources: [{ n: 1, actTitle: c.actTitle, inForce: true, number: c.number, heading: "h", text: "x" }], held }).system.includes("Never say it was not found"));
    // the model contradicts itself: the "not found" sentence goes, the rest stays
    const said = `I couldn't find Section ${c.number} of the ${c.label} Act in the library. Section ${c.number} provides the rule [1].`;
    assert.equal(dropNotFoundClaims(said, held), `Section ${c.number} provides the rule [1].`);
    // only a "not found" sentence: it is replaced by one that states where the section is
    const only = dropNotFoundClaims(`I couldn't find Section ${c.number} of the ${c.label} copy [1].`, held);
    assert.match(only, new RegExp(`is in our library \\[1\\]`)); assert.ok(!/couldn.t find/.test(only));
    assert.match(only, new RegExp(`${c.label} version of the`));
  });
}
test("nothing is dropped when no named section is held; a held central Act reads without a State", () => {
  assert.equal(dropNotFoundClaims("I couldn't find it.", []), "I couldn't find it.");
  assert.ok(!/version of the/.test(heldAddendum([{ n: 1, number: "138", actTitle: "The Negotiable Instruments Act, 1881", state: null }])));
  assert.equal(heldAddendum([]), "");
});
test("a missing section of a State's copy says which copy", () => {
  assert.equal(gapSentence({ kind: "missing", number: "34", actTitle: "The Indian Penal Code, 1860", state: "madhya-pradesh" }), "Section 34 of the Madhya Pradesh version of the Indian Penal Code isn't in our library yet.");
});
