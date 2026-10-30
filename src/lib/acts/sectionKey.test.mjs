import test from "node:test";
import assert from "node:assert/strict";
import { normSectionKey, resolveSectionKey } from "./sectionKey.mjs";

// stored shapes seen in the Acts data: BNS/BNSS/BSA/CrPC/Evidence pad to 3 (s061, s003), IPC numbers are already 3 digits, suffixes are kept (s065B), hand-filled units are not numbers at all
const PADDED = ["s001", "s003", "s012A", "s061", "s080", "s103", "s120B", "s304A", "s65B", "m58", "m59"];
const HAND_FILLED = ["sA226", "sAPP3", "sO7R11", "s0S7", "s5", "s12A", "g1", "g21", "m16"];   // an Act whose keys are not zero-padded

test("padded and unpadded spellings find the stored key", () => {
  for (const w of ["s61", "s061", "s0061", "61", "S61", "061", " s61 "]) assert.equal(resolveSectionKey(PADDED, w), "s061", w);
  for (const w of ["s3", "s003", "3"]) assert.equal(resolveSectionKey(PADDED, w), "s003", w);
  assert.equal(resolveSectionKey(PADDED, "s302"), null);
  assert.equal(resolveSectionKey(["s302"], "s0302"), "s302");
});
test("letter suffixes: s12A, s012A, 12a, s0012a all mean the same section", () => {
  for (const w of ["s12A", "s012A", "12A", "12a", "s0012a"]) assert.equal(resolveSectionKey(PADDED, w), "s012A", w);
  for (const w of ["s65B", "s065B", "65b"]) assert.equal(resolveSectionKey(PADDED, w), "s65B", w);
  for (const w of ["s120B", "s0120B"]) assert.equal(resolveSectionKey(PADDED, w), "s120B", w);
  assert.equal(resolveSectionKey(PADDED, "s12B"), null, "the suffix must match");
  assert.equal(resolveSectionKey(PADDED, "s12"), null, "12 is not 12A");
});
test("an Act that is not zero-padded still resolves, in either direction", () => {
  assert.equal(resolveSectionKey(HAND_FILLED, "s5"), "s5");
  assert.equal(resolveSectionKey(HAND_FILLED, "s005"), "s5");
  assert.equal(resolveSectionKey(HAND_FILLED, "s012A"), "s12A");
  for (const k of ["sA226", "sAPP3", "sO7R11", "s0S7", "g1", "g21"]) assert.equal(resolveSectionKey(HAND_FILLED, k), k, k);
  assert.equal(resolveSectionKey(HAND_FILLED, "sa226"), "sA226", "case does not matter");
});
test("an unknown section is null, never the first section", () => {
  for (const w of ["s9999", "s999", "999", "s0", "banana", "s61x", "sX", "g99"]) assert.equal(resolveSectionKey(PADDED, w), null, w);
  assert.equal(resolveSectionKey(PADDED, ""), null);
  assert.equal(resolveSectionKey(PADDED, undefined), null);
  assert.equal(resolveSectionKey([], "s1"), null);
});
test("a confidently-missing number can be asked for as s58 / s058 / m58 and finds the placeholder", () => {
  for (const w of ["s58", "s058", "m58", "m058", "58"]) assert.equal(resolveSectionKey(PADDED, w), "m58", w);
  assert.equal(resolveSectionKey(["s058", "m58"], "s58"), "s058", "a real section wins over the placeholder");
});
test("exact stored keys always win, and normalising is stable", () => {
  for (const k of [...PADDED, ...HAND_FILLED]) assert.equal(resolveSectionKey([...PADDED, ...HAND_FILLED], k), k, k);
  assert.equal(normSectionKey("s061"), normSectionKey("61"));
  assert.equal(normSectionKey(normSectionKey("s0012a")), normSectionKey("s0012a"));
});
