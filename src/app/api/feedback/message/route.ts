// POST /api/feedback/message {message, email?, page?} saves one free-text message from the in-app Feedback form (table in scripts/w8/w8b-feedback-messages.sql). The browser is stored as a hash;
// no IP address is stored. At most 5 messages an hour per browser. No email is sent: the message is read in /admin/insights.
import { bidOf, json } from "@/lib/drafting/http";
import { validateMessage } from "@/lib/insights/rules.mjs";
import { saveMessage } from "@/lib/insights/server";

export async function POST(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  const v = validateMessage(await req.json().catch(() => null)); if (!v.ok) return json({ error: v.error }, 422);
  const r = await saveMessage(bid, v.value);
  return r.ok ? json({ ok: true }) : json({ error: r.error }, r.status);
}
