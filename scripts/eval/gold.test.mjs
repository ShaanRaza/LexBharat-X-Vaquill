// The evaluation's "expected section" rule: any filing of the same Act's section satisfies it; a different Act with similar words does not.
import test from "node:test";
import assert from "node:assert/strict";
import { normTitle, yearOf, satisfies, widenGold } from "./gold.mjs";

const crpc = [{ act_id: "IND_state_6796", section_key: "s437", number: "437", title: "The CODE OF CRIMINAL PROCEDURE, 1973" }, { act_id: "IND_state_21613", section_key: "s437", number: "437", title: "The CRPC 1973" }];
test("normTitle and yearOf: case, 'The', punctuation and spacing do not matter", () => {
  assert.equal(normTitle("The CODE OF CRIMINAL PROCEDURE, 1973"), normTitle("The Code of Criminal Procedure,1973".replace(",1973", ", 1973")));
  assert.equal(yearOf("The CRPC 1973"), "1973"); assert.equal(yearOf("The Code of Criminal Procedure Act"), null);
});
test("a source from another filing of the same Act's section satisfies the expectation (4 different Acts)", () => {
  assert.ok(satisfies({ actId: "IND_state_21613", sectionKey: "s437", actTitle: "The CRPC 1973", number: "437" }, crpc));   // by id
  assert.ok(satisfies({ t: "The Code of Criminal Procedure, 1973", s: "437" }, crpc));                                          // a stored row: by title and number
  const ipc = [{ act_id: "A", section_key: "s302", number: "302", title: "The Indian Penal Code, 1860" }];
  assert.ok(satisfies({ t: "The Indian Penal Code, 1860", s: "302" }, ipc));
  const bns = [{ act_id: "B", section_key: "s103", number: "103", title: "The Bharatiya Nyaya Sanhita, 2023" }];
  assert.ok(satisfies({ t: "The Bharatiya Nyaya Sanhita, 2023", s: "103" }, bns));
  const ni = [{ act_id: "C", section_key: "s138", number: "138", title: "The Negotiable Instruments Act, 1881" }];
  assert.ok(satisfies({ t: "the negotiable instruments act, 1881", s: "138" }, ni));
});
test("a different Act or a different section does not satisfy it", () => {
  assert.ok(!satisfies({ t: "The Bharatiya Nagarik Suraksha Sanhita, 2023", s: "437" }, crpc));   // BNSS is not the CrPC
  assert.ok(!satisfies({ t: "The Code of Criminal Procedure, 1973", s: "438" }, crpc));          // another section of the same Act
  assert.ok(!satisfies({ t: "The Indian Penal Code, 1860", s: "437" }, crpc));
});
test("widenGold adds other filings with the same number and wording, with the same year (or none), and not another year", async () => {
  const strict = [{ act_id: "IND_state_6796", section_key: "s437", number: "437", title: "The CODE OF CRIMINAL PROCEDURE, 1973" }];
  const db = { query: async () => [{ act_id: "IND_state_6796", section_key: "s437", number: "437", title: "x" }, { act_id: "S1", section_key: "s437", number: "437", title: "The Code of Criminal Procedure, 1973" }, { act_id: "S2", section_key: "s437", number: "437", title: "The Code of Criminal Procedure Act" }, { act_id: "N", section_key: "s437", number: "437", title: "The Bharatiya Nagarik Suraksha Sanhita, 2023" }] };
  const out = await widenGold(db, strict, "anchor");
  assert.deepEqual(out.map((r) => r.act_id), ["IND_state_6796", "S1", "S2"]);   // strict first; the 2023 Act is left out
  assert.deepEqual(await widenGold(db, [], "anchor"), []);
});
