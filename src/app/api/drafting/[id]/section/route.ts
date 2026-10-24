// POST {sectionId} -> writes ONE section again (for a section that was "Not generated, retry"), in the same context as the draft (same facts, same retrieved law). Returns the text and editor nodes.
import { dbConfigured } from "@/lib/acts/db";
import { AiError, aiConfigured } from "@/lib/ai";
import { rateCheck } from "@/lib/limits/counters";
import { getTemplate } from "@/lib/drafting/catalog";
import { countNumbered, textToNodes } from "@/lib/drafting/docmodel.mjs";
import { loadSources, writeSection } from "@/lib/drafting/generate";
import { bidOf, json } from "@/lib/drafting/http";
import { getDraft, isDraftId, setSections } from "@/lib/drafting/store";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params, bid = bidOf(req);
  if (!bid || !isDraftId(id) || !dbConfigured()) return json({ error: "Draft not found." }, 404);
  if (!aiConfigured("drafting")) return json({ error: "Drafting is not set up yet (no model key)." }, 503);
  const body = (await req.json().catch(() => null)) as { sectionId?: unknown } | null;
  const d = await getDraft(bid, id).catch(() => null); if (!d) return json({ error: "Draft not found." }, 404);
  const template = getTemplate(d.templateId), section = template?.sections.find((s) => s.id === body?.sectionId);
  if (!template || !section) return json({ error: "Unknown section." }, 422);
  const rl = await rateCheck("draft-retry", bid, 12); if (!rl.ok) return json({ error: `Too many retries. Wait ${rl.retryAfterSec} seconds.` }, 429, { "Retry-After": String(rl.retryAfterSec) });
  try {
    const sources = await loadSources(d.basis);
    const previous = d.sections.filter((s) => s.status === "ok" && s.id !== section.id).map((s) => ({ title: s.title, text: s.text }));
    const r = await writeSection({ template, sectionId: section.id, values: d.fields, extra: d.extra ?? "", sources, previous });
    await setSections(id, d.sections.map((s) => (s.id === section.id ? { ...s, status: "ok" as const, text: r.text } : s)));
    // a notice numbers its paragraphs straight through, so the retried section starts after the numbered items of the sections before it
    const before = template.style === "notice" ? d.sections.slice(0, d.sections.findIndex((s) => s.id === section.id)).filter((s) => s.status === "ok").reduce((a, s) => a + countNumbered(s.text), 0) : null;
    return json({ ok: true, text: r.text, nodes: textToNodes(r.text, before === null ? null : before + 1), renumber: template.style === "notice" });
  } catch (e) { return json({ error: e instanceof AiError && ["rate_limit", "unavailable", "timeout"].includes(e.kind) ? "Busy, try again in a minute." : "The model could not write this section. Try again." }, 503); }
}
