// POST /api/access/login {password, next?} -> sets the signed access cookie (30 days). Wrong passwords: 5 per 15 minutes per address, then 429. The password and the
// secret are read only here and in the middleware; nothing is logged.
import { ACCESS_COOKIE, ACCESS_TTL_MS, accessState, createFailureLimiter, passwordMatches, safeNext, signAccessToken } from "@/lib/access/token.mjs";
import { clientKey } from "@/lib/acts/semantic.mjs";

const g = globalThis as unknown as { __accessFailures?: ReturnType<typeof createFailureLimiter> };
const failures = (g.__accessFailures ??= createFailureLimiter({ limit: 5, windowMs: 15 * 60 * 1000 }));
const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const cfg = accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV);
  if (cfg.state === "misconfigured") return Response.json({ error: "Site not configured." }, { status: 503, headers: noStore });
  if (cfg.state === "dev-open") return Response.json({ ok: true, next: "/", note: "No access password is set (local development): the site is open." }, { headers: noStore });
  const ip = clientKey(req.headers), st = failures.status(ip);
  if (st.blocked) {
    const mins = Math.ceil(st.retryAfterSec / 60);
    return Response.json({ error: `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` }, { status: 429, headers: { ...noStore, "Retry-After": String(st.retryAfterSec) } });
  }
  const body = (await req.json().catch(() => null)) as { password?: unknown; next?: unknown } | null;
  const given = typeof body?.password === "string" ? body.password.slice(0, 500) : "";
  if (!(await passwordMatches(given, cfg.password))) {
    failures.fail(ip);
    return Response.json({ error: "That password is not correct." }, { status: 401, headers: noStore });
  }
  failures.clear(ip);
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const cookie = `${ACCESS_COOKIE}=${await signAccessToken({ password: cfg.password, secret: cfg.secret })}; Path=/; Max-Age=${Math.floor(ACCESS_TTL_MS / 1000)}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
  return Response.json({ ok: true, next: safeNext(body?.next) }, { headers: { ...noStore, "Set-Cookie": cookie } });
}
