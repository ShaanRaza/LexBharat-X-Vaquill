// POST /api/admin/logout clears the admin cookie.
import { ADMIN_COOKIE } from "@/lib/insights/admin";
export async function POST() { return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store", "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict` } }); }
