// The access gate. EVERY page and API route needs the access password (a signed cookie) except the password page, its two API routes and static files (src/lib/access/token.mjs).
// Fails CLOSED: if ACCESS_PASSWORD or ACCESS_COOKIE_SECRET is missing in production the site answers "not configured" and never opens. In local development without a password the site is
// open and shows a warning banner. Every response also carries an anonymous random browser id cookie (used for saved chats and limits), passed to route handlers as the x-lb-bid header.
import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, BROWSER_COOKIE, accessState, isBrowserId, isPublicPath, isStaticPath, newBrowserId, verifyAccessToken } from "@/lib/access/token.mjs";

const YEAR = 365 * 24 * 3600;

function pass(req: NextRequest) {
  // The browser id is always taken from the cookie or made here; a value sent by the client in x-lb-bid is overwritten.
  const have = req.cookies.get(BROWSER_COOKIE)?.value, bid = isBrowserId(have) ? have : newBrowserId();
  const headers = new Headers(req.headers);
  headers.set("x-lb-bid", bid);
  const res = NextResponse.next({ request: { headers } });
  if (bid !== have) res.cookies.set(BROWSER_COOKIE, bid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR, secure: req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https" });
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (isStaticPath(pathname)) return NextResponse.next();
  const cfg = accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV);
  if (pathname === "/access" || pathname.startsWith("/api/access/")) { const r = pass(req); r.headers.set("Cache-Control", "no-store"); return r; }
  if (cfg.state === "misconfigured") {
    if (pathname.startsWith("/api/")) return Response.json({ error: "Site not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.rewrite(new URL("/access", req.url), { status: 503, headers: { "Cache-Control": "no-store" } });   // the password page explains "site not configured"
  }
  if (cfg.state === "ready") {
    const ok = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value, { password: cfg.password, secret: cfg.secret });
    if (!ok) {
      if (pathname.startsWith("/api/")) return Response.json({ error: "The access password is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
      const to = new URL("/access", req.url);
      if (pathname !== "/") to.searchParams.set("next", pathname + search);
      return NextResponse.redirect(to);
    }
  }
  const res = pass(req);
  if (cfg.state === "ready") res.headers.set("Cache-Control", res.headers.get("Cache-Control") ?? "private, no-cache");   // pages behind a password must not be cached by shared caches
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
