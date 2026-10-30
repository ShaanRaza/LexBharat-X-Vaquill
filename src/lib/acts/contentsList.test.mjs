import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeContentsList, headingIsContentsList, isContentsList, effectiveStatus } from "./contentsList.mjs";

const LIST = "375. Rape. 376. Punishment for rape. 376A. Punishment for causing death or resulting in persistent vegetative state of victim. 376AB. Punishment for rape on woman under twelve years of age. 376B. Sexual intercourse by husband upon his wife during separation.";
test("the IPC 375 contents list is a list", () => { assert.ok(looksLikeContentsList(LIST)); assert.ok(isContentsList({ body: LIST })); });
test("a list in the heading is a list", () => { assert.ok(headingIsContentsList("Rape. 376. Punishment for rape. 376A. Punishment for causing death")); assert.ok(isContentsList({ heading: "Rape. 376. Punishment for rape. 376A. Punishment", body: null })); });
test("real section text is not a list", () => {
  assert.ok(!looksLikeContentsList("420. Cheating and dishonestly inducing delivery of property.—Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine."));
  assert.ok(!looksLikeContentsList("(1) Where a person is arrested. 2. The officer shall inform him. This is an ordinary paragraph of law text that mentions numbers 3. in passing and goes on for a while."));
  assert.ok(!looksLikeContentsList(""));
  assert.ok(!headingIsContentsList("Man. Woman")); assert.ok(!headingIsContentsList(null));
});
test("numbered definitions that do not count up are not a list", () => {
  assert.ok(!looksLikeContentsList("5. Alpha thing. 40. Beta thing. 12. Gamma thing. 77. Delta thing. 3. Epsilon thing."));
});
test("a list is never 'complete'; other statuses and other texts are unchanged", () => {
  assert.equal(effectiveStatus("complete", { body: LIST }), "possibly_incomplete");
  assert.equal(effectiveStatus("complete", { body: "Whoever cheats shall be punished." }), "complete");
  assert.equal(effectiveStatus("garbled", { body: LIST }), "garbled");
  assert.equal(effectiveStatus("possibly_incomplete", { body: LIST }), "possibly_incomplete");
});
