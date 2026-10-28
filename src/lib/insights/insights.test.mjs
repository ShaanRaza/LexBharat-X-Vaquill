import test from "node:test";
import assert from "node:assert/strict";
import { byDay, csvCell, ratio, toCsv, validateFeedback } from "./rules.mjs";

test("feedback is validated", () => {
  const ok = validateFeedback({ feature: "chat", vote: "down", itemId: "123", reasons: ["Wrong law", "Nonsense", "Wrong law"], comment: "  it   missed\n s. 138  " });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.value, { feature: "chat", vote: "down", itemId: "123", reasons: ["Wrong law"], comment: "it missed s. 138" });
  assert.equal(validateFeedback({ feature: "chat", vote: "up", itemId: "9", reasons: ["Wrong law"], comment: "x" }).value.comment, "", "no comment after a thumbs-up");
  assert.equal(validateFeedback({ feature: "nope", vote: "up", itemId: "9" }).ok, false);
  assert.equal(validateFeedback({ feature: "chat", vote: "meh", itemId: "9" }).ok, false);
  assert.equal(validateFeedback({ feature: "chat", vote: "up", itemId: "a b" }).ok, false);
  assert.equal(validateFeedback(null).ok, false);
  assert.equal(validateFeedback({ feature: "chat", vote: "down", itemId: "1", comment: "x".repeat(5000) }).value.comment.length, 1000);
});
test("csv escaping", () => {
  assert.equal(csvCell('say "hi", ok'), '"say ""hi"", ok"');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell(["a", "b"]), "a; b");
  assert.equal(csvCell(null), "");
  assert.equal(toCsv([{ key: "a", label: "A" }, { key: "b", label: "B" }], [{ a: 1, b: "x,y" }]), 'A,B\r\n1,"x,y"\r\n');
});
test("ratio", () => { assert.deepEqual(ratio(3, 1), { up: 3, down: 1, total: 4, upPct: 75 }); assert.equal(ratio(0, 0).upPct, null); });
test("counters become one row per day", () => {
  const rows = [
    { day: "2026-10-24", metric: "visit", key: "chat", n: 3 }, { day: "2026-10-24", metric: "visit", key: "vault", n: 1 }, { day: "2026-10-24", metric: "chat_asked", key: "", n: 2 },
    { day: "2026-10-24", metric: "answer_time", key: "", n: 2, sum_ms: 9000 }, { day: "2026-10-23", metric: "draft", key: "rent-agreement", n: 1 }, { day: "2026-10-23", metric: "scan", key: "", n: 4 },
  ];
  const d = byDay(rows);
  assert.deepEqual(d.map((x) => x.day), ["2026-10-24", "2026-10-23"]);
  assert.equal(d[0].visits, 4); assert.equal(d[0].chats, 2); assert.equal(d[0].avgAnswerSec, 4.5);
  assert.equal(d[1].drafts, 1); assert.equal(d[1].draftsByTemplate["rent-agreement"], 1); assert.equal(d[1].scans, 4); assert.equal(d[1].avgAnswerSec, null);
});

import { MAX_MESSAGE, validateMessage } from "./rules.mjs";
test("a feedback message needs some text, tolerates no email, rejects a bad one, and keeps the page as a path only", () => {
  assert.deepEqual(validateMessage({ message: "  The search missed s.138  ", email: "", page: "/workspace/chat?x=1#y" }), { ok: true, value: { message: "The search missed s.138", email: "", page: "/workspace/chat" } });
  assert.equal(validateMessage({ message: "ok" }).ok, false); assert.equal(validateMessage(null).ok, false); assert.equal(validateMessage({ message: "x".repeat(MAX_MESSAGE + 1) }).ok, false);
  assert.equal(validateMessage({ message: "fine", email: "not-an-email" }).ok, false); assert.equal(validateMessage({ message: "fine", email: "a@b.in" }).ok, true);
  assert.equal(validateMessage({ message: "fine", page: "javascript:alert(1)" }).value.page, ""); assert.equal(validateMessage({ message: "fine", page: "https://evil.example/x" }).value.page, "");
  assert.equal(validateMessage({ message: "line one\r\nline two" }).value.message, "line one\nline two");
});
