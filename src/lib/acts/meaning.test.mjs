import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { askNoticeFor, causeOf, cacheControlFor, docNoticeFor, fellBackBecause, FALLBACK_NOTICE, isFallback, meaningStats, noticeFor, safeDetail, UNAVAILABLE_NOTICE, whyFor, CAUSES } from "./meaning.mjs";

const err = (name, message) => Object.assign(new Error(message), { name });

test("causeOf names the real reason from the error the code throws", () => {
  assert.equal(causeOf(new Error("voyage 429")), "rate_limited");
  assert.equal(causeOf(new Error("voyage 503")), "voyage_down");
  assert.equal(causeOf(new Error("voyage 401")), "voyage_refused");
  assert.equal(causeOf(new Error("voyage unreachable")), "voyage_down");
  assert.equal(causeOf(new Error("no voyage key")), "not_configured");
  assert.equal(causeOf(new Error("voyage returned unexpected vectors")), "voyage_bad_answer");
  assert.equal(causeOf(err("TimeoutError", "The operation was aborted due to timeout")), "timeout");
  assert.equal(causeOf(err("NeonDbError", "Error connecting to database: fetch failed")), "vector_store");
  assert.equal(causeOf(new Error("qdrant 500")), "vector_store");
  assert.equal(causeOf(new Error("no vector store answered")), "vector_store");
  assert.equal(causeOf(new Error("something else")), "other");
  assert.equal(causeOf(undefined), "other");
});

test("a Voyage network failure is never blamed on the vector database", () => {
  // embed.ts turns any fetch failure into "voyage unreachable" ("fetch failed" alone would read as a database problem)
  assert.equal(causeOf(new Error("voyage unreachable")), "voyage_down");
  assert.match(fs.readFileSync(new URL("./embed.ts", import.meta.url), "utf8"), /new Error\("voyage unreachable"\)/);
});

test("safeDetail never carries a connection string, a key or a query", () => {
  assert.equal(safeDetail(new Error("voyage 429")), "voyage 429");
  assert.equal(safeDetail(err("NeonDbError", "connect to postgresql://user:secret@host/db failed")), "NeonDbError");
  assert.equal(safeDetail(new Error("Bearer pa-abc123 rejected for query 'bail'")), "Error");
});

test("what the reader is told, and when", () => {
  assert.equal(FALLBACK_NOTICE, "Showing exact-word results — meaning search is busy.");
  const limit = fellBackBecause("rate_limited");
  assert.deepEqual(limit, { used: false, reason: "semantic_error", cause: "rate_limited" });
  assert.equal(noticeFor(limit), "Showing exact-word results — meaning search has reached its request limit for now.");
  assert.equal(noticeFor(fellBackBecause("voyage_down")), FALLBACK_NOTICE);   // busy
  assert.equal(noticeFor(fellBackBecause("vector_store")), FALLBACK_NOTICE);
  assert.match(noticeFor(fellBackBecause("timeout")), /took too long/);
  assert.match(noticeFor(fellBackBecause("voyage_refused")), /refused by its provider/);
  assert.equal(noticeFor(fellBackBecause("not_configured")), UNAVAILABLE_NOTICE);
  // nothing to say when meaning search was used, or exact words / a quoted phrase / Hindi were what the reader asked for
  for (const s of [{ used: true }, { used: false, reason: "exact_requested" }, { used: false, reason: "quoted_phrase" }, { used: false, reason: "hindi" }, undefined, null]) { assert.equal(noticeFor(s), ""); assert.equal(isFallback(s), false); }
});

test("a fallback answer is never cached by the CDN; every other answer keeps the shared cache", () => {
  assert.equal(cacheControlFor(fellBackBecause("timeout")), "no-store");
  assert.equal(cacheControlFor(fellBackBecause("rate_limited")), "no-store");
  assert.match(cacheControlFor({ used: true }), /s-maxage=300/);
  assert.match(cacheControlFor({ used: false, reason: "exact_requested" }), /s-maxage=300/);
  assert.match(cacheControlFor(undefined), /s-maxage=300/);
  assert.match(cacheControlFor(fellBackBecause("not_configured")), /s-maxage/);   // a configuration state, not a hiccup
});

test("Ask is told when some searches behind an answer fell back", () => {
  assert.equal(askNoticeFor({ used: 3, fellBack: 0, judgmentsFailed: false }), "");
  assert.match(askNoticeFor({ used: 2, fellBack: 1 }), /some of the sections.*exact words/);
  assert.match(askNoticeFor({ used: 0, fellBack: 2 }), /all of the sections.*exact words/);
  assert.match(askNoticeFor({ used: 3, fellBack: 0, judgmentsFailed: true, judgmentsCause: "voyage_down" }), /Meaning search is busy, so the Supreme Court passages were left out/);
  assert.match(askNoticeFor({ used: 3, fellBack: 0, judgmentsFailed: true, judgmentsCause: "voyage_down", judgmentsRecovered: true }), /found by exact words only/);
  assert.equal(askNoticeFor(null), "");
});

test("meaningStats: share and causes per surface", () => {
  const rows = [
    { metric: "meaning_search", key: "acts", n: 90 }, { metric: "meaning_search", key: "acts", n: 10 },
    { metric: "meaning_fallback", key: "acts:rate_limited", n: 4 }, { metric: "meaning_fallback", key: "acts:timeout", n: 1 },
    { metric: "meaning_search", key: "regulators", n: 20 },
  ];
  const [acts, reg] = meaningStats(rows);
  assert.deepEqual({ s: acts.surface, searches: acts.searches, fellBack: acts.fellBack, pct: acts.pct, causes: acts.causes }, { s: "acts", searches: 100, fellBack: 5, pct: 5, causes: { rate_limited: 4, timeout: 1 } });
  assert.deepEqual({ s: reg.surface, fellBack: reg.fellBack, pct: reg.pct }, { s: "regulators", fellBack: 0, pct: 0 });
  assert.deepEqual(meaningStats([]), []);
});

// ---- the class: no search path may fall back silently ------------------------------------------------------------------------------------------------------
const SRC = fileURLToPathDir(new URL("../../", import.meta.url));
function fileURLToPathDir(u) { return decodeURIComponent(u.pathname); }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(ts|tsx|mjs)$/.test(e.name) && !/\.test\.|\.d\.mts$/.test(e.name) ? [path.join(d, e.name)] : []));
const files = walk(SRC), read = (f) => fs.readFileSync(f, "utf8"), rel = (f) => path.relative(SRC, f);

test("class: every file that embeds a query or runs a meaning search also logs a fallback (meaningFellBack)", () => {
  // embed.ts defines embedding; scText.ts only throws to its callers (the route and Ask retrieval catch and log); the probe throws to the selftest, which reports it
  const exempt = new Set(["lib/acts/embed.ts", "lib/judgments/scText.ts", "lib/acts/meaningProbe.ts", "app/api/vault/selftest/route.ts"]);
  const users = files.filter((f) => /embedQuery\(|searchJudgmentsByMeaning\(|semanticSearch\(|semanticRegulators\(/.test(read(f)) && !exempt.has(rel(f)));
  assert.ok(users.length >= 5, `expected the search paths, found ${users.map(rel)}`);
  const silent = users.filter((f) => !/meaningFellBack\(/.test(read(f))).map(rel);
  assert.deepEqual(silent, [], `these files run a meaning search but never log a fallback: ${silent}`);
});

test("class: a search route never hard-codes a shared cache for an answer that may be a fallback", () => {
  // the chat route streams (no CDN cache) and the selftest is not a search
  const routes = files.filter((f) => rel(f).startsWith("app/api/") && /searchSections\(|searchRegulators\(|searchJudgmentsByMeaning\(/.test(read(f)) && !/api\/(chat|vault)\//.test(rel(f)));
  const wrong = routes.filter((f) => !/cacheControlFor\(/.test(read(f)) || /"public, s-maxage/.test(read(f))).map(rel);
  assert.ok(routes.length >= 2);
  assert.deepEqual(wrong, [], `these routes can cache a keyword fallback: ${wrong}`);
});

test("class: every screen that shows meaning-search results can tell the reader about a fallback (noticeFor)", () => {
  // Quick-find and the Desk ask the Acts search for exact words only (always &exact=1), so they never use meaning
  const exactOnly = new Set(["components/shell/useQuickFind.ts", "components/desk/useDesk.ts"]);
  const meaningScreens = files.filter((f) => rel(f).startsWith("components/") && /api\/acts\/search|api\/judgments\/search-text/.test(read(f)) && !exactOnly.has(rel(f)));
  for (const f of exactOnly) assert.ok(/api\/acts\/search\?q=[^`]*&exact=1`/.test(read(path.join(SRC, f))), `${f} must ask for exact words only`);
  assert.ok(meaningScreens.length >= 2, `found ${meaningScreens.map(rel)}`);
  const mute = meaningScreens.filter((f) => !/noticeFor\(/.test(read(f))).map(rel);
  assert.deepEqual(mute, [], `these screens show meaning results without a fallback notice: ${mute}`);
});

test("class: Ask passes its fallback to the reader and to the eval", () => {
  const chat = read(path.join(SRC, "app/api/chat/route.ts")), e2e = fs.readFileSync(path.join(SRC, "../scripts/eval/e2e.mjs"), "utf8");
  assert.match(chat, /askNoticeFor\(/);
  assert.match(chat, /meaning: ret\.meaning/);
  assert.match(e2e, /out\.meaning = ev\.meaning/);
});

test("every cause is named in words, in one of three families, on every surface", () => {
  for (const c of CAUSES) {
    const w = whyFor(c);
    assert.ok(["limit", "not_set_up", "busy"].includes(w.family), c);
    assert.ok(w.clause.startsWith("meaning search"), c);
    assert.match(askNoticeFor({ used: 0, fellBack: 1, cause: c }), new RegExp(w.clause.replace(/[()]/g, "\\$&"), "i"), `ask ${c}`);
    assert.match(docNoticeFor(c), new RegExp(w.clause.replace(/[()]/g, "\\$&"), "i"), `vault ${c}`);
  }
  assert.equal(whyFor("rate_limited").family, "limit");
  assert.equal(whyFor("not_configured").family, "not_set_up");
  assert.equal(whyFor("timeout").family, "busy");
  assert.match(askNoticeFor({ used: 0, fellBack: 1, cause: "rate_limited" }), /^Meaning search has reached its request limit for now, so all of the sections/);
});

test("Ask says both things when the sections and the Supreme Court passages both fell back", () => {
  const m = { used: 0, fellBack: 1, cause: "rate_limited", judgmentsFailed: true, judgmentsCause: "rate_limited", judgmentsRecovered: true };
  assert.match(askNoticeFor(m), /request limit.*all of the sections.*exact words only.*Supreme Court passages were found by exact words only and may be less relevant for the same reason/);
  assert.match(askNoticeFor({ ...m, judgmentsCause: "timeout", judgmentsRecovered: false }), /took too long, so the Supreme Court passages were left out/);
});
