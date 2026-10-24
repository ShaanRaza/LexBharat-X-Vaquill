import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery, parseSectionLookup, actMatcher, hasDevanagari, hasSearchableChars, MAX_Q } from "./searchQuery.mjs";

test("normalizeQuery trims, collapses spaces and rejects empty, one-character and over-long input", () => {
  assert.deepEqual(normalizeQuery("  dishonour   of cheque "), { q: "dishonour of cheque" });
  assert.ok(normalizeQuery("").error); assert.ok(normalizeQuery("a").error); assert.ok(normalizeQuery(undefined).error);
  assert.ok(normalizeQuery("x".repeat(MAX_Q + 1)).error);
  assert.equal(normalizeQuery("x".repeat(MAX_Q)).q.length, MAX_Q);
});

test("section lookups in the shapes people type", () => {
  const cases = { "138 NI Act": ["138", "NI Act"], "section 10 contract act": ["10", "contract act"], "Section 138 of the Negotiable Instruments Act": ["138", "Negotiable Instruments Act"],
    "NI Act section 138": ["138", "NI Act"], "contract act s. 10": ["10", "contract act"], "ni act 138": ["138", "ni act"], "s 11A kerala buildings act": ["11A", "kerala buildings act"], "ipc 302": ["302", "ipc"] };
  for (const [q, [n, a]] of Object.entries(cases)) { const r = parseSectionLookup(q); assert.ok(r, q); assert.equal(r.number, n, q); assert.equal(r.actPhrase.toLowerCase(), a.toLowerCase(), q); }
});

test("ordinary searches are not mistaken for lookups", () => {
  for (const q of ["dishonour of cheque", "free consent", "\"wilful default\"", "138", "cheque 2 days", "section"]) assert.equal(parseSectionLookup(q), null, q);
});

test("actMatcher: aliases give a title prefix, other phrases give the words that must appear", () => {
  assert.equal(actMatcher("NI Act").titlePrefix, "the negotiable instruments act, 1881");
  assert.equal(actMatcher("contract act").titlePrefix, "the indian contract act, 1872");
  assert.deepEqual(actMatcher("kerala buildings (lease and rent control) act"), { titlePrefix: null, words: ["kerala", "buildings", "(lease", "rent", "control)"] });
});

test("script and character checks", () => {
  assert.ok(hasDevanagari("धारा 138")); assert.ok(!hasDevanagari("section 138"));
  assert.ok(!hasSearchableChars("!!! ??? ###")); assert.ok(hasSearchableChars("a1"));
});

import { splitHighlight, MARK_OPEN as O, MARK_CLOSE as C } from "./highlight.mjs";
test("splitHighlight turns the database markers into parts and cleans markdown", () => {
  assert.deepEqual(splitHighlight(`**138.** the ${O}dishonour${C} of a ${O}cheque${C}.`), [{ text: "138. the ", hit: false }, { text: "dishonour", hit: true }, { text: " of a ", hit: false }, { text: "cheque", hit: true }, { text: ".", hit: false }]);
  assert.deepEqual(splitHighlight("no marks"), [{ text: "no marks", hit: false }]);
  assert.deepEqual(splitHighlight(`broken ${O}open`), [{ text: "broken ", hit: false }, { text: "open", hit: false }]);
  assert.deepEqual(splitHighlight(""), []);
});

test("Constitution lookups: Articles and Schedules", async () => {
  const { parseSectionLookup } = await import("./searchQuery.mjs");
  const want = (q, number) => assert.deepEqual([parseSectionLookup(q)?.number, parseSectionLookup(q)?.actPhrase], [number, "constitution of india"], q);
  want("Article 21", "A21"); want("Art. 226 Constitution", "A226"); want("Article 32", "A32"); want("Art 14", "A14"); want("Article 21A", "A21A"); want("article 243ZH of the Constitution of India", "A243ZH");
  want("Constitution Article 19", "A19"); want("Seventh Schedule", "S7"); want("7th Schedule of the Constitution", "S7");
  assert.equal(parseSectionLookup("Article 137 Limitation Act").number, "A137"); assert.match(parseSectionLookup("Article 137 Limitation Act").actPhrase, /limitation/);
  assert.equal(parseSectionLookup("Article 21 of the Constitution rights"), null);
});
