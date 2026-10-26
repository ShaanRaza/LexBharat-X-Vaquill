import test from "node:test";
import assert from "node:assert/strict";
import { buildSegments, findMatches, leadingNumber, paragraphRequest } from "./readerSegments.mjs";

test("matches are found case-insensitively; one character finds nothing", () => {
  assert.deepEqual(findMatches("Res judicata and RES JUDICATA", "res judicata").map((m) => m.start), [0, 17]);
  assert.deepEqual(findMatches("abc", "a"), []);
});
test("segments cut at link and highlight boundaries, and the text is never changed", () => {
  const text = "under Section 138 of the Act applies", m = [{ start: 6, end: 17, href: "/x", title: "t" }], h = [{ start: 14, end: 22 }];
  const seg = buildSegments(text, m, h, 14);
  assert.equal(seg.map((p) => p.text).join(""), text);
  assert.ok(seg.some((p) => p.href && p.hit && p.active), "overlap keeps both");
});
test("a mention without a link is not cut", () => {
  assert.equal(buildSegments("a Section 5 b", [{ start: 2, end: 11, href: null }]).length, 1);
});
test("paragraph numbers are read only where the text has them", () => {
  assert.equal(leadingNumber("12. The appellant"), 12); assert.equal(leadingNumber("(7) The Court"), 7);
  assert.equal(leadingNumber("In 2005. The"), null); assert.equal(leadingNumber("1234. x"), null);
  assert.equal(paragraphRequest("para 12"), 12); assert.equal(paragraphRequest("¶3"), 3); assert.equal(paragraphRequest("paragraph"), null);
});
