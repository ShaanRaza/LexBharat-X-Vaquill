import test from "node:test";
import assert from "node:assert/strict";
import table from "../../config/repealed-acts.json" with { type: "json" };
import { repealedNote } from "./repealed.mjs";

test("IPC, CrPC and the Evidence Act point to the Act that replaced them, as a whole", () => {
  assert.deepEqual(repealedNote("IND_REP_659_1860", table), { text: "Repealed — see BNS", short: "BNS", newName: "Bharatiya Nyaya Sanhita, 2023", name: "Indian Penal Code, 1860", href: "/law/IND_central_20062" });
  assert.equal(repealedNote("IND_state_6796", table).short, "BNSS");
  assert.equal(repealedNote("IND_REP_971_1872", table).href, "/law/IND_central_20063");
});
test("other Acts, and the note itself, give nothing", () => {
  assert.equal(repealedNote("IND_central_2189", table), null);
  assert.equal(repealedNote(null, table), null);
  assert.equal(repealedNote("_note", table), null);
});
