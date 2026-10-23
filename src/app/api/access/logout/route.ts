// POST /api/access/logout -> clears the access cookie. (The browser id cookie stays, so saved chats are still there after the next login.)
import { ACCESS_COOKIE } from "@/lib/access/token.mjs";

export async function POST(req: Request) {
  const https = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${ACCESS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}` } });
}
