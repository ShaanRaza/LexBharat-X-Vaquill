import test from "node:test";
import assert from "node:assert/strict";
import { looksLikeContentsList, confirmedByHeadings, headingIsContentsList, isContentsList, effectiveStatus } from "./contentsList.mjs";

const LIST = "375. Rape. 376. Punishment for rape. 376A. Punishment for causing death or resulting in persistent vegetative state of victim. 376AB. Punishment for rape on woman under twelve years of age. 376B. Sexual intercourse by husband upon his wife during separation.";
const HEADINGS = { 376: "Punishment for rape.", "376A": "Punishment for causing death or resulting in persistent vegetative state of victim.", "376AB": "Punishment for rape on woman under twelve years of age." };
const headingOf = (n) => HEADINGS[String(n).toUpperCase()];

test("the IPC 375 contents list is a list: shape, and the Act's own headings confirm it", () => {
  assert.ok(looksLikeContentsList(LIST, "375"));
  assert.ok(confirmedByHeadings(LIST, headingOf));
  assert.ok(isContentsList({ body: LIST, number: "375" }, headingOf));
});
test("without the Act's headings a block is never called a list (no guessing)", () => { assert.ok(!isContentsList({ body: LIST, number: "375" })); assert.ok(!confirmedByHeadings(LIST)); });
test("a list in the title is a list on its own", () => { assert.ok(headingIsContentsList("Rape. 376. Punishment for rape. 376A. Punishment for causing death or resulting in persistent vegeta")); assert.ok(isContentsList({ heading: "Rape. 376. Punishment for rape. 376A. Punishment" })); });
test("real section text is not a list", () => {
  assert.ok(!looksLikeContentsList("420. Cheating and dishonestly inducing delivery of property.—Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.", "420"));
  assert.ok(!looksLikeContentsList("", "1")); assert.ok(!headingIsContentsList("Man. Woman")); assert.ok(!headingIsContentsList(null));
});
test("numbered lists that are law text (Schedules) are not contents lists", () => {
  const institutions = "109. The National Institute of Health Administration and Education, New Delhi. 110. The All-India Institute of Hygiene and Public Health, Calcutta. 111. The Indian Statistical Institute, Calcutta. 112. The Indian Council of Medical Research.";
  assert.ok(!looksLikeContentsList(institutions, "9"));   // does not start with the section's own number
  const goods = "23. Compound gas, such as oxygen gas, hydrogen gas. 24. Cotton waste. 25. Cotton seed. 26. Detonators. 27. Dry leaves. 28. Dynamite.";
  assert.ok(looksLikeContentsList(goods, "23"));          // looks like one by shape ...
  assert.ok(!confirmedByHeadings(goods, (n) => ({ 24: "Definitions.", 25: "Power to make rules.", 26: "Penalties." })[n]));   // ... but the Act's sections 24-26 are titled otherwise
  assert.ok(!isContentsList({ body: goods, number: "23" }, (n) => ({ 24: "Definitions.", 25: "Power to make rules." })[n]));
  assert.ok(!looksLikeContentsList("4. The Punjab Motor Vehicles Taxation (Delhi Amendment) Act, 1955 (2 of 1956). 5. The Maternity Benefit Act, 1961 (53 of 1961). 6. The Payment of Gratuity Act, 1972 (39 of 1972).", "4"));
});
test("numbers that do not count up are not a list", () => { assert.ok(!looksLikeContentsList("5. Alpha thing. 40. Beta thing. 12. Gamma thing. 77. Delta thing. 3. Epsilon thing.", "5")); });
test("a list is never 'complete'; other statuses and other texts are unchanged", () => {
  assert.equal(effectiveStatus("complete", { body: LIST, number: "375" }, headingOf), "possibly_incomplete");
  assert.equal(effectiveStatus("complete", { body: "Whoever cheats shall be punished.", number: "420" }, headingOf), "complete");
  assert.equal(effectiveStatus("garbled", { body: LIST, number: "375" }, headingOf), "garbled");
  assert.equal(effectiveStatus("possibly_incomplete", { body: LIST, number: "375" }, headingOf), "possibly_incomplete");
});
test("the label test is lighter than the chat's test, and a Schedule list passes neither", () => {
  const list = "56. Salary and allowances of Presiding Officers. 57. Filling up of vacancies. 58. Resignation and removal. 59. Staff of the Tribunal.";
  const one = (n) => ({ 57: "Filling up of vacancies." })[n];
  assert.ok(looksLikeContentsList(list, "56"));
  assert.ok(isContentsList({ body: list, number: "56" }, one));                  // one title matches: enough for a label
  assert.ok(!confirmedByHeadings(list, one));                                    // not enough for the chat to drop it
  assert.ok(!isContentsList({ body: "23. Compound gas. 24. Cotton waste. 25. Cotton seed. 26. Detonators.", number: "23" }, (n) => ({ 24: "Definitions.", 25: "Rules." })[n]));
});
test("a title that is a list of a real Act's sections is flagged; a title that is a list of items is not", () => {
  const act = (n) => ({ 376: "Punishment for rape.", "376A": "Punishment for causing death or resulting in persistent vegetative state of victim." })[String(n).toUpperCase()];
  assert.ok(headingIsContentsList("Rape. 376. Punishment for rape. 376A. Punishment for causing death or resulting in persistent vegeta", act));
  assert.ok(!headingIsContentsList("198. Dark-rumped Swift 199. Glossy Swiftlet 200. Indian Swiftlet", act));
});
