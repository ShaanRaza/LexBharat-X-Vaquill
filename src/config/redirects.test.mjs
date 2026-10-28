import test from "node:test";
import assert from "node:assert/strict";
import { HOME, REDIRECTS, toNextRedirects } from "./redirects.mjs";

const GOOD = new Set([HOME, "/access", "/privacy", "/security"]);
const rule = (path) => REDIRECTS.find(([s]) => s === path || (s.endsWith("/:path*") && (path === s.slice(0, -7) || path.startsWith(s.slice(0, -6)))));
/** Follows redirects the way a browser would; returns the final path, or throws if it never settles. */
const follow = (path) => { for (let i = 0; i < 6; i++) { const r = rule(path); if (!r) return path; path = r[1]; } throw new Error(`redirect cycle from ${path}`); };

test("every redirect has a distinct source and a known destination, and following it always ends on a real page", () => {
  const sources = REDIRECTS.map(([s]) => s);
  assert.equal(new Set(sources).size, sources.length, "duplicate source");
  for (const [s, d] of REDIRECTS) { assert.ok(GOOD.has(d), `${s} -> ${d}`); assert.notEqual(s, d); }
  for (const [s] of REDIRECTS) { const start = s.replace("/:path*", "/x"); const end = follow(start); assert.ok(!rule(end) && GOOD.has(end), `${start} ends on ${end}`); }
});
test("no kept page is redirected away, and every removed area is covered", () => {
  for (const kept of ["/workspace/chat", "/workspace/browse", "/workspace/vault", "/access", "/admin/insights", "/privacy", "/terms", "/security", "/api/vault", "/_next/static/x"]) assert.equal(follow(kept), kept === "/security" ? "/security" : kept, kept);
  for (const area of ["/developer", "/docs", "/auth/login", "/about", "/blog/x", "/contact", "/playground", "/mcp", "/dpa", "/sla", "/cookies", "/delete-data", "/refund-policy", "/accessibility", "/word/sideload", "/use-case/legal-tech-developers", "/security/vulnerability-disclosure"]) assert.ok(rule(area), area);
  assert.equal(follow("/auth/login"), "/access"); assert.equal(follow("/cookies"), "/privacy"); assert.equal(follow("/security/vulnerability-disclosure"), "/security"); assert.equal(follow("/"), HOME); assert.equal(follow("/docs/api-guide/x"), HOME);
});
test("Next.js gets them as temporary redirects in Phase 1", () => {
  const n = toNextRedirects(); assert.equal(n.length, REDIRECTS.length); assert.ok(n.every((r) => r.permanent === false && r.source.startsWith("/") && r.destination.startsWith("/")));
});
