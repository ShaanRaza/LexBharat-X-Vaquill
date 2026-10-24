// POST /api/usage/visit {page} counts one visit to a workspace page, once per browser per page per day. The page must be one of the known names; nothing else is stored.
import { bidOf, json } from "@/lib/drafting/http";
import { noteVisit } from "@/lib/insights/server";

const PAGES = new Set(["home", "chat", "drafting", "review", "vault", "browse", "other"]);
export async function POST(req: Request) {
  const bid = bidOf(req), body = await req.json().catch(() => null), page = typeof body?.page === "string" ? body.page : "";
  if (bid && PAGES.has(page)) await noteVisit(bid, page);
  return json({ ok: true });
}
