// POST /api/access/login {password, next?} -> sets the signed access cookie (30 days). A wrong password is answered after about one second; there is no lockout and no other limit.
// The password and the secret are read only here and in the middleware; nothing is logged.
import { ACCESS_COOKIE, ACCESS_TTL_MS, accessState, passwordMatches, safeNext, signAccessToken } from "@/lib/access/token.mjs";

const WRONG_PASSWORD_DELAY_MS = 1000;
const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const cfg = accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV);
  if (cfg.state === "misconfigured") return Response.json({ error: "Site not configured." }, { status: 503, headers: noStore });
  if (cfg.state === "dev-open") return Response.json({ ok: true, next: "/", note: "No access password is set (local development): the site is open." }, { headers: noStore });
  const body = (await req.json().catch(() => null)) as { password?: unknown; next?: unknown } | null;
  const given = typeof body?.password === "string" ? body.password.slice(0, 500) : "";
  if (!(await passwordMatches(given, cfg.password))) {
    await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS));
    return Response.json({ error: "Wrong password, try again." }, { status: 401, headers: noStore });
  }
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const cookie = `${ACCESS_COOKIE}=${await signAccessToken({ password: cfg.password, secret: cfg.secret })}; Path=/; Max-Age=${Math.floor(ACCESS_TTL_MS / 1000)}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
  return Response.json({ ok: true, next: safeNext(body?.next) }, { headers: { ...noStore, "Set-Cookie": cookie } });
}
