// GET /api/drafting -> the templates (as the pages need them), this browser's saved drafts, usage and limits, and whether "email me" is available.
import { dbConfigured } from "@/lib/app-db";
import { aiConfigured } from "@/lib/ai";
import limitConfig from "@/config/drafting-limits.json";
import { readLimits } from "@/lib/chat/limits.mjs";
import { TEMPLATES, templateCard } from "@/lib/drafting/catalog";
import { emailConfigured } from "@/lib/drafting/email.mjs";
import { bidOf, envOf, json } from "@/lib/drafting/http";
import { draftUsage, listDrafts } from "@/lib/drafting/store";

export async function GET(req: Request) {
  const bid = bidOf(req);
  if (!bid) return json({ error: "No browser id." }, 400);
  const l = readLimits(limitConfig, envOf(), "DRAFT_LIMIT");
  const base = { templates: TEMPLATES.map(templateCard), emailAvailable: emailConfigured(envOf()), limits: { daily: l.daily, weekly: l.weekly, maxSaved: limitConfig.maxSaved }, ready: dbConfigured() && aiConfigured("drafting") };
  if (!dbConfigured()) return json({ ...base, drafts: [], usage: { day: 0, week: 0 } });
  try { const [drafts, u] = await Promise.all([listDrafts(bid), draftUsage(bid)]); return json({ ...base, drafts, usage: { day: u.day, week: u.week } }); }
  catch { return json({ ...base, drafts: [], usage: { day: 0, week: 0 }, error: "Could not load your drafts." }, 503); }
}
