import test from "node:test";
import assert from "node:assert/strict";
import { HOME, REDIRECTS, toNextRedirects } from "./redirects.mjs";

const GOOD = new Set(["/", "/access", "/privacy", "/security", "/search", "/library", "/admin"]);
const plain = REDIRECTS.filter((r) => !r.has);
/** Follows the entries without a `has` rule the way a browser would (the `has` ones are checked separately below); returns the final path, or throws on a loop. */
const rule = (path) => plain.find((r) => r.source === path || (r.source.endsWith("/:path*") && (path === r.source.slice(0, -7) || path.startsWith(r.source.slice(0, -6)))) || (r.source.includes("/:") && !r.source.endsWith("/:path*") && new RegExp(`^${r.source.replace(/:[a-z]+/g, "[^/]+")}$`).test(path)));
const dest = (r, path) => { let i = 0; const parts = path.split("/").filter(Boolean), src = r.source.split("/").filter(Boolean); const caps = {}; src.forEach((s, k) => { if (s.startsWith(":")) caps[s.replace(/[:*]/g, "")] = s.endsWith("*") ? parts.slice(k).join("/") : parts[k]; }); return r.destination.replace(/:([a-z]+)\*?/g, (_, n) => caps[n] ?? "").replace(/\/+$/, "") || "/"; };
const follow = (path) => { for (let i = 0; i < 6; i++) { const r = rule(path); if (!r) return path; path = dest(r, path); } throw new Error(`redirect cycle from ${path}`); };

test("every redirect is permanent, has a destination, and following one always ends on a page that exists", () => {
  assert.ok(toNextRedirects().every((r) => r.permanent === true && r.source.startsWith("/") && r.destination.startsWith("/")));
  const sources = REDIRECTS.map((r) => `${r.source}|${JSON.stringify(r.has ?? "")}`); assert.equal(new Set(sources).size, sources.length, "duplicate entry");
  for (const r of REDIRECTS) assert.notEqual(r.source, r.destination);
  for (const r of plain) { const start = r.source.replace("/:path*", "/x").replace(/:[a-z]+/g, "x"); const end = follow(start); assert.ok(!rule(end), `${start} ends on ${end}`); }
});
test("the old workspace addresses go to their new homes, with ids kept", () => {
  const want = { "/workspace": "/", "/workspace/chat": "/ask", "/workspace/chat/abc": "/ask/abc", "/workspace/search": "/search", "/workspace/browse": "/library", "/workspace/browse/acts/IND_central_2189": "/law/IND_central_2189",
    "/workspace/browse/judgments/supreme-court-of-india": "/library/judgments/supreme-court-of-india", "/workspace/browse/judgments/supreme-court-of-india/2014/2014_INSC_514": "/judgments/supreme-court-of-india/2014/2014_INSC_514",
    "/workspace/drafting": "/work/drafts", "/workspace/drafting/abc": "/work/drafts/abc", "/workspace/drafting/new/t1": "/work/drafts/new/t1", "/workspace/review": "/work/reviews", "/workspace/review/abc": "/work/reviews/abc",
    "/workspace/vault": "/work/vault", "/workspace/vault/abc": "/work/vault/abc", "/work/documents": "/work/vault", "/work/documents/abc": "/work/vault/abc", "/admin/insights": "/admin" };
  for (const [from, to] of Object.entries(want)) assert.equal(follow(from), to, from);
});
test("an old Act address with ?section= and the old Acts tab are caught by the entries with a `has` rule, before the plain ones", () => {
  const i = (src, key) => REDIRECTS.findIndex((r) => r.source === src && r.has?.[0]?.key === key), j = (src) => REDIRECTS.findIndex((r) => r.source === src && !r.has);
  assert.ok(i("/workspace/browse/acts/:act", "section") >= 0 && i("/workspace/browse/acts/:act", "section") < j("/workspace/browse/acts/:act"));
  assert.ok(i("/workspace/browse", "tab") >= 0 && i("/workspace/browse", "tab") < j("/workspace/browse"));
  assert.equal(REDIRECTS.find((r) => r.has?.[0]?.key === "section").destination, "/law/:act/:section"); assert.equal(REDIRECTS.find((r) => r.has?.[0]?.key === "tab").destination, "/search");
});
test("no page that stays is redirected away, and every removed area is covered", () => {
  for (const kept of ["/ask", "/ask/x", "/search", "/library", "/law/x/s138", "/judgments/c/2014/x", "/work/drafts", "/work/vault", "/access", "/admin", "/privacy", "/terms", "/security", "/api/vault", "/_next/static/x"]) assert.equal(follow(kept), kept, kept);
  for (const area of ["/developer", "/docs", "/auth/login", "/about", "/blog/x", "/contact", "/playground", "/mcp", "/dpa", "/sla", "/cookies", "/delete-data", "/refund-policy", "/accessibility", "/word/sideload", "/use-case/legal-tech-developers", "/security/vulnerability-disclosure"]) assert.ok(rule(area), area);
  assert.equal(follow("/auth/login"), "/access"); assert.equal(follow("/cookies"), "/privacy"); assert.equal(follow("/security/vulnerability-disclosure"), "/security"); assert.equal(follow("/docs/api-guide/x"), HOME);
});
