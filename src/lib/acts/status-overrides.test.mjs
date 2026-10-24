import test from "node:test";
import assert from "node:assert/strict";
import ov from "../../config/status-overrides.json" with { type: "json" };
import table from "../../config/repealed-acts.json" with { type: "json" };
import { repealedNote } from "./repealed.mjs";

test("every status override says why, keeps the raw value, and has a 'Repealed — see' note", () => {
  const e = Object.entries(ov.overrides);
  assert.ok(e.length >= 70);
  for (const [id, o] of e) {
    assert.equal(o.status, "repealed");
    assert.ok(o.reason.length > 30, id);
    assert.ok(o.rawStatus, id);
    assert.ok(repealedNote(id, table), id);
  }
});
test("CrPC and the four labour Acts are overridden", () => {
  for (const id of ["IND_state_6796", "IND_state_8322", "IND_state_7792", "IND_state_6323", "IND_state_9160"]) assert.equal(ov.overrides[id].status, "repealed");
  assert.equal(repealedNote("IND_state_6323", table).short, "OSH Code");
});
