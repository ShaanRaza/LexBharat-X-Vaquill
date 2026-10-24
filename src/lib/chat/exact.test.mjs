import test from "node:test";
import assert from "node:assert/strict";
import { narrowToExact } from "./exact.mjs";

const h = (actId, sectionKey) => ({ actId, sectionKey }), key = (x) => `${x.actId}|${x.sectionKey}`;
test("the named unit goes first and other Acts are dropped", () => {
  const hits = [h("RAJ", "s061"), h("CPC", "sO7R1"), h("CPC", "sO7R11"), h("IT", "s004"), h("CPC", "sO7"), h("CPC", "s011")];
  assert.deepEqual(narrowToExact(hits, ["CPC|sO7R11"], key).map(key), ["CPC|sO7R11", "CPC|sO7R1", "CPC|sO7", "CPC|s011"]);
});
test("only 3 neighbours stay; several named units keep their order; nothing found keeps everything", () => {
  const hits = [h("A", "1"), h("A", "2"), h("A", "3"), h("A", "4"), h("A", "5"), h("B", "9")];
  assert.deepEqual(narrowToExact(hits, ["A|3"], key).map(key), ["A|3", "A|1", "A|2", "A|4"]);
  assert.deepEqual(narrowToExact(hits, ["B|9", "A|2"], key).map(key), ["B|9", "A|2", "A|1", "A|3", "A|4"]);
  assert.equal(narrowToExact(hits, ["Z|0"], key), hits);
});
