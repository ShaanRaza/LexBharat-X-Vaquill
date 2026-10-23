import test from "node:test";
import assert from "node:assert/strict";
import { hasQuotedPhrase, chooseMode, cacheKey, LruCache, createRateLimiter, clientKey, vectorLiteral, distinctSections, highlightQuery, rankSections } from "./semantic.mjs";

test("quoted phrases are detected (straight and curly quotes), single quotes and lone quotes are not", () => {
  assert.equal(hasQuotedPhrase('"dishonour of cheque" penalty'), true);
  assert.equal(hasQuotedPhrase("“anticipatory bail”"), true);
  assert.equal(hasQuotedPhrase("it's a cheque"), false);
  assert.equal(hasQuotedPhrase('a lone " quote'), false);
});
test("chooseMode: semantic by default; keyword for exact, quotes, Hindi, or when semantic is not configured", () => {
  assert.deepEqual(chooseMode("what is the punishment for cheque bounce"), { mode: "semantic", reason: null });
  assert.equal(chooseMode("x", { exact: true }).reason, "exact_requested");
  assert.equal(chooseMode('"force majeure"').reason, "quoted_phrase");
  assert.equal(chooseMode("चेक", { hindi: true }).reason, "hindi");
  assert.deepEqual(chooseMode("bail", { semanticReady: false }), { mode: "text", reason: "semantic_unavailable" });
});
test("cacheKey ignores case and spacing", () => { assert.equal(cacheKey("  Cheque   BOUNCE "), "cheque bounce"); });
test("LruCache evicts the least recently used entry", () => {
  const c = new LruCache(2); c.set("a", 1); c.set("b", 2); c.get("a"); c.set("c", 3);
  assert.equal(c.get("b"), undefined); assert.equal(c.get("a"), 1); assert.equal(c.get("c"), 3); assert.equal(c.size, 2);
});
test("rate limiter: allows the limit, blocks the next, frees after the window, keeps callers apart", () => {
  let t = 0; const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  for (let i = 0; i < 3; i++) assert.equal(rl.check("ip1").ok, true);
  const blocked = rl.check("ip1"); assert.equal(blocked.ok, false); assert.equal(blocked.retryAfterSec, 1);
  assert.equal(rl.check("ip2").ok, true);
  t = 1001; assert.equal(rl.check("ip1").ok, true);
});
test("rate limiter forgets old callers beyond maxKeys", () => {
  const rl = createRateLimiter({ limit: 1, maxKeys: 2 });
  rl.check("a"); rl.check("b"); rl.check("c");
  assert.equal(rl.check("a").ok, true); // "a" was dropped, so it starts fresh
});
test("clientKey takes the first forwarded address", () => {
  const h = (o) => ({ get: (k) => o[k] ?? null });
  assert.equal(clientKey(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })), "1.2.3.4");
  assert.equal(clientKey(h({ "x-real-ip": "9.9.9.9" })), "9.9.9.9");
  assert.equal(clientKey(h({})), "unknown");
});
test("vectorLiteral rounds to 7 places", () => { assert.equal(vectorLiteral([0.123456789, -1, 0]), "[0.1234568,-1,0]"); });
test("distinctSections keeps first (best) occurrence and respects the limit", () => {
  const rows = [{ actId: "A", sectionKey: "s1" }, { actId: "A", sectionKey: "s1" }, { actId: "B", sectionKey: "s2" }, { actId: "A", sectionKey: "s3" }];
  assert.deepEqual(distinctSections(rows, 2).map((r) => `${r.actId}|${r.sectionKey}`), ["A|s1", "B|s2"]);
});
test("highlightQuery drops short and filler words", () => {
  assert.equal(highlightQuery("What is the punishment for cheque bounce?"), "punishment or cheque or bounce");
  assert.equal(highlightQuery("is it to"), "");
});
test("rankSections: repealed Acts count 0.9x, garbled and unknown sections are dropped, ties are stable", () => {
  const info = new Map([["A|s1", { actStatus: "repealed", status: "complete" }], ["B|s1", { actStatus: "in_force", status: "complete" }], ["C|s1", { actStatus: "in_force", status: "garbled" }]]);
  const cands = [{ actId: "A", sectionKey: "s1", distance: 0.30 }, { actId: "B", sectionKey: "s1", distance: 0.33 }, { actId: "C", sectionKey: "s1", distance: 0.1 }, { actId: "D", sectionKey: "s1", distance: 0.1 }];
  assert.deepEqual(rankSections(cands, info).map((r) => r.actId), ["B", "A"]); // 0.67 beats 0.7 x 0.9 = 0.63
  assert.deepEqual(rankSections(cands, info, 1).map((r) => r.actId), ["B"]);
  assert.deepEqual(rankSections([{ actId: "A", sectionKey: "s1", distance: 0.30 }, { actId: "B", sectionKey: "s1", distance: 0.30 }], new Map([["A|s1", { actStatus: "in_force", status: "complete" }], ["B|s1", { actStatus: "in_force", status: "complete" }]])).map((r) => r.actId), ["A", "B"]);
});
