import { test } from "node:test";
import assert from "node:assert/strict";
import { assertReadOnly, newTally, measureText, endRow, report } from "./measureLib.mjs";

test("only a single SELECT passes the read-only guard", () => {
  assert.ok(assertReadOnly("SELECT count(*) AS n FROM act_sections WHERE body IS NOT NULL"));
  for (const q of ["UPDATE act_sections SET body = ''", "DELETE FROM sc_cases", "SELECT 1; DROP TABLE acts", "WITH x AS (DELETE FROM a RETURNING *) SELECT * FROM x", "ALTER TABLE a ADD text_raw text", "INSERT INTO a VALUES (1)", "SELECT 1 FROM a; SELECT 2"])
    assert.throws(() => assertReadOnly(q), /refused/, q);
});
test("a word like 'update' inside a quoted string does not trip the guard", () => {
  assert.ok(assertReadOnly("SELECT * FROM act_sections WHERE heading = 'update'"));
});
test("tally counts rows once, lists ambiguous kinds apart, and keeps 3 examples", () => {
  const t = newTally("Test");
  const rows = ["A. <b>x</b> &amp; y", "B. 1[Provided that z.] [Repealed]", "C. plain text", "D. text\n1. Subs. by Act 1 of 2000.\n", "E. <p>a</p> <p>b</p>", "F. <i>q</i>"];
  for (const [i, text] of rows.entries()) { const st = {}; measureText(t, `row${i}`, text, st); endRow(t, st); }
  assert.equal(t.scanned, 6);
  assert.equal(t.wouldChange, 4);
  assert.equal(t.withAmbiguous, 1);
  assert.equal(t.kinds.get("html_tag").rows.size, 3);
  assert.equal(t.kinds.get("html_tag").examples.length, 3);
  assert.equal(t.kinds.get("numbered_bracket").group, "ambiguous");
  const md = report([{ ...t, total: 6 }]);
  assert.match(md, /AMBIGUOUS kinds/);
  assert.match(md, /\| Test \| 6 \| 6 \| 4/);
});
