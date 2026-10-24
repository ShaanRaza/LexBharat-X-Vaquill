// POST /api/admin/login {password} -> sets the signed admin cookie (12 hours). A wrong password is answered after about one second. Nothing is logged.
import { passwordMatches } from "@/lib/access/token.mjs";
import { ADMIN_COOKIE, ADMIN_TTL_MS, adminState, signAdmin } from "@/lib/insights/admin";

const noStore = { "Cache-Control": "no-store" };
export async function POST(req: Request) {
  const a = adminState();
  if (a.state !== "ready") return Response.json({ error: a.state === "same_as_access" ? "The admin password must be different from the site access password." : "The admin page is not set up yet." }, { status: 503, headers: noStore });
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null, given = typeof body?.password === "string" ? body.password.slice(0, 500) : "";
  if (!(await passwordMatches(given, a.password))) { await new Promise((r) => setTimeout(r, 1000)); return Response.json({ error: "Wrong password, try again." }, { status: 401, headers: noStore }); }
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  const cookie = `${ADMIN_COOKIE}=${await signAdmin(a)}; Path=/; Max-Age=${Math.floor(ADMIN_TTL_MS / 1000)}; HttpOnly; SameSite=Strict${https ? "; Secure" : ""}`;
  return Response.json({ ok: true }, { headers: { ...noStore, "Set-Cookie": cookie } });
}
