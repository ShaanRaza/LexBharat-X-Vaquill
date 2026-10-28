// The admin password for /admin: a second password (ADMIN_PASSWORD) that must differ from the site's ACCESS_PASSWORD, kept in its own signed cookie. Server-only. Nothing here logs or returns a password.
import { constantTimeEqual, signAccessToken, verifyAccessToken } from "@/lib/access/token.mjs";

export const ADMIN_COOKIE = "lb_admin", ADMIN_TTL_MS = 12 * 3600 * 1000;
export type AdminState = { state: "ready"; password: string; secret: string } | { state: "not_set" } | { state: "same_as_access" } | { state: "no_secret" };

export function adminState(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): AdminState {
  const password = env.ADMIN_PASSWORD?.trim() ? env.ADMIN_PASSWORD : "", secret = env.ACCESS_COOKIE_SECRET?.trim() ?? "";
  if (!password) return { state: "not_set" };
  if (env.ACCESS_PASSWORD && constantTimeEqual(password, env.ACCESS_PASSWORD)) return { state: "same_as_access" };   // the admin page must not open with the password everyone has
  if (secret.length < 32) return { state: "no_secret" };
  return { state: "ready", password, secret: `${secret}:admin` };
}
export async function signAdmin(a: Extract<AdminState, { state: "ready" }>) { return signAccessToken({ password: a.password, secret: a.secret, ttlMs: ADMIN_TTL_MS }); }
export async function isAdminCookie(value: string | undefined | null): Promise<boolean> {
  const a = adminState(); if (a.state !== "ready") return false;
  return verifyAccessToken(value, { password: a.password, secret: a.secret });
}
export const cookieOf = (req: Request, name: string) => { const m = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.get("cookie") ?? ""); return m ? m[1] : undefined; };
