// POST /api/feedback {feature, itemId, vote, reasons?, comment?} saves a thumbs up/down (voting again changes it); GET /api/feedback?feature=chat&ids=1,2 returns this browser's own votes.
// The item must belong to this browser; the question/answer shown to the admin are read from the server's own copy, not sent by the browser.
import { bidOf, json } from "@/lib/drafting/http";
import { FEATURES, validateFeedback } from "@/lib/insights/rules.mjs";
import { insightsConfigured, myVotes, saveFeedback } from "@/lib/insights/server";

export async function POST(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "No browser id." }, 400);
  const body = await req.json().catch(() => null), v = validateFeedback(body);
  if (!v.ok) return json({ error: v.error }, 422);
  const r = await saveFeedback(bid, v.value);
  return r.ok ? json({ ok: true, vote: r.vote }) : json({ error: r.error }, r.status);
}

export async function GET(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ votes: {} });
  const u = new URL(req.url), feature = u.searchParams.get("feature") ?? "", ids = (u.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter((s) => /^[A-Za-z0-9_-]{1,64}$/.test(s));
  if (!FEATURES.includes(feature) || !insightsConfigured()) return json({ votes: {} });
  return json({ votes: await myVotes(bid, feature, ids).catch(() => ({})) });
}
