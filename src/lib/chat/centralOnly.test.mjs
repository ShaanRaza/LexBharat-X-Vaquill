import test from "node:test";
import assert from "node:assert/strict";
import { centralNames, withoutStateCopies } from "./centralOnly.mjs";

const hits = [
  { n: 1, category: "state", actTitle: "The Indian Penal Code" },                                   // Madhya Pradesh copy
  { n: 2, category: "central", actTitle: "The Bharatiya Nyaya Sanhita, 2023" },
  { n: 3, category: "state", actTitle: "The Madhya Pradesh Land Revenue Code, 1959" },
];
test("a state copy of a named central Act is dropped, other state Acts and central Acts stay", () => {
  const names = centralNames([{ category: "central", actTitle: "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)" }]);
  assert.deepEqual([...names], ["indian penal code"]);
  assert.deepEqual(withoutStateCopies(hits, names).map((h) => h.n), [2, 3]);
});
test("nothing is dropped when the question names a state, or names no central Act", () => {
  const names = centralNames([{ category: "central", actTitle: "The Indian Penal Code, 1860" }]);
  assert.equal(withoutStateCopies(hits, names, true).length, 3);
  assert.equal(withoutStateCopies(hits, centralNames([])).length, 3);
  assert.equal(centralNames([{ category: "state", actTitle: "The Indian Penal Code" }]).size, 0);   // a state Act the question named does not count as central
});
test("every central Act works the same way, not only the IPC", () => {
  const h = [{ category: "state", actTitle: "The Negotiable Instruments Act, 1881" }, { category: "central", actTitle: "The Negotiable Instruments Act, 1881" }];
  assert.deepEqual(withoutStateCopies(h, centralNames([{ category: "central", actTitle: "The Negotiable Instruments Act, 1881" }])).map((x) => x.category), ["central"]);
});
