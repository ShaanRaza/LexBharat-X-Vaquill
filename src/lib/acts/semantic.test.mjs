import test from "node:test";
import assert from "node:assert/strict";
import { hasQuotedPhrase, chooseMode, cacheKey, LruCache, createRateLimiter, clientKey, vectorLiteral, distinctSections, highlightQuery, rankSections, copyKey, statesIn } from "./semantic.mjs";

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
test("copyKey: same Act filed under different titles/years/spacing shares a key; blocks without a number do not", () => {
  assert.equal(copyKey("The CODE OF CRIMINAL PROCEDURE, 1973", "438"), copyKey("The Code of Criminal Procedure,1973", "438"));
  assert.equal(copyKey("The INDIAN-PENAL-CODE-1860", "302"), copyKey("The Indian Penal Code", "302"));
  assert.notEqual(copyKey("The Factories Act, 1948", "7"), copyKey("The Factories Act, 1948", "7A"));
  assert.equal(copyKey("The Factories Act, 1948", null), null);
});
test("rankSections collapses copies of one section: the Central filing wins and the State copies never outrank it", () => {
  const mk = (title, central, status = "in_force") => ({ actStatus: status, status: "complete", central, title, number: "438" });
  const info = new Map([["C|s438", mk("The Code of Criminal Procedure, 1973", true)], ["M|s438", mk("The CODE OF CRIMINAL PROCEDURE, 1973", false)], ["P|s438", mk("The Code of Criminal Procedure,1973", false)], ["X|s5", { actStatus: "in_force", status: "complete", central: false, title: "Other Act", number: "5" }]]);
  const cands = [{ actId: "M", sectionKey: "s438", distance: 0.20 }, { actId: "P", sectionKey: "s438", distance: 0.21 }, { actId: "C", sectionKey: "s438", distance: 0.22 }, { actId: "X", sectionKey: "s5", distance: 0.25 }];
  const r = rankSections(cands, info, 60, 0.9, { central: 1 });
  assert.deepEqual(r.map((x) => x.actId), ["C", "X"]);
  assert.equal(r[0].copies, 2); assert.equal(r[0].central, true);
  assert.ok(Math.abs(r[0].score - 0.8) < 1e-9); // takes the best score in the group (the State copy's 0.80)
});
test("rankSections between two State copies keeps the better-scoring one", () => {
  const info = new Map([["A|s1", { actStatus: "in_force", status: "complete", central: false, title: "Kerala Act", number: "5" }], ["B|s1", { actStatus: "in_force", status: "complete", central: false, title: "The Kerala Act", number: "5" }]]);
  const r = rankSections([{ actId: "A", sectionKey: "s1", distance: 0.4 }, { actId: "B", sectionKey: "s1", distance: 0.3 }], info);
  assert.deepEqual(r.map((x) => x.actId), ["B"]); assert.equal(r[0].copies, 1);
});
test("statesIn finds State and UT names, including two-word names and spellings, and ignores look-alike words", () => {
  assert.deepEqual([...statesIn("rent control in Maharashtra")], ["maharashtra"]);
  assert.deepEqual([...statesIn("What is stamp duty in Tamil Nadu and Kerala?")].sort(), ["kerala", "tamil-nadu"]);
  assert.deepEqual([...statesIn("Orissa land law")], ["odisha"]);
  assert.equal(statesIn("what is the goal of arbitration, a bihari tradition").size, 0);
  assert.equal(statesIn("how to get anticipatory bail").size, 0);
});
test("rankSections boosts: Central x1.3 when no state is named; the named State's Acts x1.2 (Central gets none then)", () => {
  const info = new Map([["C|s1", { actStatus: "in_force", status: "complete", central: true, title: "Central Rent Act", number: "1", state: null }], ["M|s1", { actStatus: "in_force", status: "complete", central: false, title: "Maharashtra Rent Act", number: "1", state: "maharashtra" }]]);
  const cands = [{ actId: "M", sectionKey: "s1", distance: 0.30 }, { actId: "C", sectionKey: "s1", distance: 0.35 }];
  assert.deepEqual(rankSections(cands, info).map((x) => x.actId), ["C", "M"]);                                        // 0.65 x 1.3 = 0.845 > 0.70
  assert.deepEqual(rankSections(cands, info, 60, 0.9, { states: new Set(["maharashtra"]) }).map((x) => x.actId), ["M", "C"]); // 0.70 x 1.2 = 0.84 > 0.65
});
