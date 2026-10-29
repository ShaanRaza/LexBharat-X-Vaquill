import test from "node:test";
import assert from "node:assert/strict";
import { dedupeCopies } from "./dedupe.mjs";

const h = (actId, actTitle, number, extra = {}) => ({ actId, sectionKey: `s${number}`, actTitle, number, ...extra });
test("a section filed under two Act records is one result; the first (best) is kept and the copies counted", () => {
  const out = dedupeCopies([h("a", "The Indian Penal Code, 45 of 1860 (Rep., Act 45 of 2023)", "302"), h("b", "The INDIAN PENAL CODE", "302"), h("c", "The Bharatiya Nyaya Sanhita, 2023", "103")]);
  assert.deepEqual(out.map((x) => x.actId), ["a", "c"]); assert.equal(out[0].copies, 1);
  const arb = dedupeCopies([h("a", "The Arbitration and Conciliation Act, 1996", "7"), h("b", "The Arbitration & Conciliation Act 1996", "7")]);
  assert.equal(arb.length, 1);
});
test("different sections of the same Act, and unnumbered text, are never merged", () => {
  assert.equal(dedupeCopies([h("a", "The NI Act, 1881", "138"), h("a", "The NI Act, 1881", "139")]).length, 2);
  assert.equal(dedupeCopies([h("a", "The NI Act, 1881", null), h("b", "The NI Act, 1881", null)]).length, 2);
});
