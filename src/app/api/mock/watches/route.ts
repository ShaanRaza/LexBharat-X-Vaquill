// MOCK ENDPOINT: create/list/delete "watches" in the SIMULATED in-memory database (src/lib/mockStore.ts).
import { addWatch, removeWatch, watches, watchableSources } from "@/lib/mockStore";

export async function GET() {
  return Response.json({ _mock: true, sources: watchableSources, watches });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { source?: string; delivery?: "webhook" | "email" | "both"; target?: string };
  if (typeof b.source !== "string" || typeof b.target !== "string" || !b.source || !b.target) return Response.json({ _mock: true, error: "source and target are required" }, { status: 400 });
  const delivery = b.delivery ?? "email";
  const target = b.target.trim().slice(0, 200);
  const looksEmail = /^\S+@\S+\.\S+$/.test(target);
  const looksUrl = /^https:\/\/\S+$/.test(target);
  if (delivery === "email" && !looksEmail) return Response.json({ _mock: true, error: "Enter a valid email address." }, { status: 400 });
  if (delivery === "webhook" && !looksUrl) return Response.json({ _mock: true, error: "Enter a webhook URL starting with https://" }, { status: 400 });
  if (delivery === "both" && !(looksEmail || looksUrl)) return Response.json({ _mock: true, error: "Enter an email address or an https:// webhook URL." }, { status: 400 });
  if (watches.length >= 50) return Response.json({ _mock: true, error: "Demo limit reached (50 watches). Delete one first." }, { status: 429 });
  return Response.json({ _mock: true, watch: addWatch({ source: b.source, delivery, target }) });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  return Response.json({ _mock: true, deleted: removeWatch(id) });
}
