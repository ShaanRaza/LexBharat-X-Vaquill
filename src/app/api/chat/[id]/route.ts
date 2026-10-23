// GET /api/chat/<id> -> one chat with its messages; DELETE removes it. Only the browser that made the chat can open or delete it.
import { dbConfigured } from "@/lib/acts/db";
import { isBrowserId } from "@/lib/access/token.mjs";
import { deleteChat, getChat, isChatId } from "@/lib/chat/store";

const noStore = { "Cache-Control": "no-store" };
const ctx = (req: Request, id: string) => { const b = req.headers.get("x-lb-bid"); return isBrowserId(b) && isChatId(id) ? b : null; };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, bid = ctx(req, id);
  if (!bid || !dbConfigured()) return Response.json({ error: "Chat not found." }, { status: 404, headers: noStore });
  const chat = await getChat(bid, id).catch(() => null);
  return chat ? Response.json(chat, { headers: noStore }) : Response.json({ error: "Chat not found." }, { status: 404, headers: noStore });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, bid = ctx(req, id);
  if (!bid || !dbConfigured()) return Response.json({ error: "Chat not found." }, { status: 404, headers: noStore });
  const ok = await deleteChat(bid, id).catch(() => false);
  return Response.json({ ok }, { status: ok ? 200 : 404, headers: noStore });
}
