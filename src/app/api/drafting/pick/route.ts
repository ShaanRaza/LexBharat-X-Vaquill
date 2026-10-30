// POST /api/drafting/pick {text} -> the closest template for a sentence describing what the user needs: { templateId, why, fit }.
import { aiFailure } from "@/lib/ai/notice.mjs";
import { AiError, aiConfigured, completeAi } from "@/lib/ai";
import { rateCheck } from "@/lib/limits/counters";
import { TEMPLATES } from "@/lib/drafting/catalog";
import { bidOf, json } from "@/lib/drafting/http";
import { buildPickPrompt, parsePick } from "@/lib/drafting/prompts.mjs";


export async function POST(req: Request) {
  const bid = bidOf(req);
  if (!bid) return json({ error: "No browser id." }, 400);
  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (text.length < 8) return json({ error: "Describe what you need in a sentence (at least 8 characters)." }, 422);
  if (text.length > 600) return json({ error: "Please keep it to 600 characters." }, 422);
  if (!aiConfigured("templatePick")) return json({ error: "Drafting is not set up yet (no model key)." }, 503);
  const rl = await rateCheck("draft-pick", bid, 15);
  if (!rl.ok) return json({ error: `Too many requests. Wait ${rl.retryAfterSec} seconds.` }, 429, { "Retry-After": String(rl.retryAfterSec) });
  try {
    const p = buildPickPrompt(TEMPLATES, text);
    const pick = parsePick((await completeAi("templatePick", { system: p.system, messages: p.messages, json: true })).text, TEMPLATES);
    return pick ? json(pick) : json({ error: "I could not match that to a template. Pick one from the list." }, 422);
  } catch (e) { return json({ error: e instanceof AiError && e.kind !== "bad_request" ? aiFailure(e).message : "Something went wrong. Pick a template from the list." }, 503); }
}
