// Access-password cookie: signing, checking and constant-time comparison. PURE logic on the Web Crypto API (the same code runs in the Edge middleware and in Node route handlers). No styling.
// Cookie value: "v1.<expiry ms>.<hmac>". The HMAC covers the expiry AND a fingerprint of the current ACCESS_PASSWORD, so changing the password (or the secret) invalidates every cookie.
const enc = new TextEncoder();
export const ACCESS_COOKIE = "lb_access", BROWSER_COOKIE = "lb_bid", ACCESS_TTL_MS = 30 * 24 * 3600 * 1000;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(String(s))));
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(String(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** Compares two strings in time that depends only on the longer length, not on where they first differ. */
export function constantTimeEqual(a, b) {
  const x = String(a), y = String(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** True when `input` is the password. Both sides are hashed first, so the comparison is over equal-length digests whatever the password lengths. */
export async function passwordMatches(input, expected) {
  const [a, b] = await Promise.all([sha256Hex(input ?? ""), sha256Hex(expected ?? "")]);
  return constantTimeEqual(a, b);
}

export async function signAccessToken({ password, secret, now = Date.now(), ttlMs = ACCESS_TTL_MS }) {
  const exp = now + ttlMs, fp = (await sha256Hex(password)).slice(0, 16);
  return `v1.${exp}.${await hmacHex(secret, `v1.${exp}.${fp}`)}`;
}

export async function verifyAccessToken(token, { password, secret, now = Date.now() }) {
  const m = /^v1\.(\d{10,16})\.([0-9a-f]{64})$/.exec(String(token ?? ""));
  if (!m || Number(m[1]) < now) return false;
  const fp = (await sha256Hex(password)).slice(0, 16);
  return constantTimeEqual(await hmacHex(secret, `v1.${m[1]}.${fp}`), m[2]);
}

/** A new random browser id (128 bits, URL-safe). */
export function newBrowserId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const isBrowserId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{22,64}$/.test(v);

/** Where the gate stands. "ready": password and secret set. "dev-open": no password in development (the site is open, with a warning). "misconfigured": anything else (production without a password or secret, or a password without a secret): fail closed. */
export function accessState(env, nodeEnv) {
  const password = env.ACCESS_PASSWORD?.trim() ? env.ACCESS_PASSWORD : "", secret = env.ACCESS_COOKIE_SECRET?.trim() ?? "";
  if (password && secret.length >= 32) return { state: "ready", password, secret };
  if (!password && nodeEnv !== "production") return { state: "dev-open", password: "", secret: "" };
  return { state: "misconfigured", password: "", secret: "" };
}

/** Paths that never need the password: the password page and its two API routes, framework and static files. Everything else is gated. */
export function isPublicPath(pathname) {
  return pathname === "/access" || pathname.startsWith("/api/access/") || pathname.startsWith("/_next/") || pathname.startsWith("/data/") || pathname.startsWith("/brand/")
    || pathname === "/favicon.ico" || pathname === "/icon.svg" || pathname === "/robots.txt";
}
/** Static files (no cookie is set for these). */
export const isStaticPath = (pathname) => pathname.startsWith("/_next/") || pathname.startsWith("/data/") || pathname.startsWith("/brand/") || pathname === "/favicon.ico" || pathname === "/icon.svg" || pathname === "/robots.txt";

/** Only a path on this site: "/x", never "//host" or "https://host". */
export const safeNext = (n) => (typeof n === "string" && /^\/(?!\/)[^\\\r\n]*$/.test(n) && !n.startsWith("/access") ? n : "/");
