import test from "node:test";
import assert from "node:assert/strict";
import { constantTimeEqual, passwordMatches, signAccessToken, verifyAccessToken, newBrowserId, isBrowserId, accessState, isPublicPath, safeNext, ACCESS_TTL_MS } from "./token.mjs";

const secret = "s".repeat(40);
test("constantTimeEqual: equal, different, different length, empty", () => {
  assert.equal(constantTimeEqual("abc", "abc"), true); assert.equal(constantTimeEqual("abc", "abd"), false);
  assert.equal(constantTimeEqual("abc", "abcd"), false); assert.equal(constantTimeEqual("", ""), true); assert.equal(constantTimeEqual("", "a"), false);
});
test("passwordMatches: right, wrong, empty, different length", async () => {
  assert.equal(await passwordMatches("open sesame", "open sesame"), true);
  assert.equal(await passwordMatches("open sesamE", "open sesame"), false);
  assert.equal(await passwordMatches("", "open sesame"), false);
  assert.equal(await passwordMatches(undefined, "open sesame"), false);
  assert.equal(await passwordMatches("x", "open sesame"), false);
});
test("token: valid until expiry, 30 days by default, rejects tampering, other secret and other password", async () => {
  const now = 1_800_000_000_000;
  const t = await signAccessToken({ password: "pw", secret, now });
  assert.equal(await verifyAccessToken(t, { password: "pw", secret, now: now + 1000 }), true);
  assert.equal(await verifyAccessToken(t, { password: "pw", secret, now: now + ACCESS_TTL_MS - 1 }), true);
  assert.equal(await verifyAccessToken(t, { password: "pw", secret, now: now + ACCESS_TTL_MS + 1 }), false);
  assert.equal(await verifyAccessToken(t.replace(/.$/, (c) => (c === "0" ? "1" : "0")), { password: "pw", secret, now }), false);
  assert.equal(await verifyAccessToken(t.replace(/\.(\d+)\./, (_, e) => `.${Number(e) + 1}.`), { password: "pw", secret, now }), false); // expiry cannot be extended
  assert.equal(await verifyAccessToken(t, { password: "pw2", secret, now }), false);   // changing ACCESS_PASSWORD logs everyone out
  assert.equal(await verifyAccessToken(t, { password: "pw", secret: "t".repeat(40), now }), false);
  for (const junk of [undefined, "", "v1.abc", "v2.1800000000000.aa", "x".repeat(300)]) assert.equal(await verifyAccessToken(junk, { password: "pw", secret, now }), false);
});
test("browser ids are random, URL-safe and recognised", () => {
  const a = newBrowserId(), b = newBrowserId();
  assert.notEqual(a, b); assert.ok(isBrowserId(a)); assert.ok(!isBrowserId("short")); assert.ok(!isBrowserId("has spaces and ! chars......"));
});
test("accessState: ready, dev-open, and fail closed", () => {
  assert.equal(accessState({ ACCESS_PASSWORD: "pw", ACCESS_COOKIE_SECRET: secret }, "production").state, "ready");
  assert.equal(accessState({}, "development").state, "dev-open");
  assert.equal(accessState({ ACCESS_PASSWORD: "  " }, "development").state, "dev-open");
  assert.equal(accessState({}, "production").state, "misconfigured");                                          // production without a password never opens
  assert.equal(accessState({ ACCESS_PASSWORD: "pw" }, "production").state, "misconfigured");                   // no secret
  assert.equal(accessState({ ACCESS_PASSWORD: "pw", ACCESS_COOKIE_SECRET: "short" }, "development").state, "misconfigured");
  assert.equal(accessState({ ACCESS_COOKIE_SECRET: secret }, "production").state, "misconfigured");
});
test("isPublicPath: only the password page, its API, and static files", () => {
  for (const p of ["/access", "/api/access/login", "/api/access/logout", "/_next/static/x.js", "/data/acts/acts.legislation.json", "/brand/logo.svg", "/favicon.ico"]) assert.equal(isPublicPath(p), true, p);
  for (const p of ["/", "/workspace/browse", "/api/acts/search", "/api/chat", "/accessory", "/api/accessx", "/access/extra"]) assert.equal(isPublicPath(p), false, p);
});
test("safeNext keeps only same-site paths", () => {
  assert.equal(safeNext("/workspace/chat?x=1"), "/workspace/chat?x=1");
  for (const bad of ["//evil.com", "https://evil.com", "/\\evil", "javascript:alert(1)", "", undefined, "/access", "/access?next=/"]) assert.equal(safeNext(bad), "/", String(bad));
});
