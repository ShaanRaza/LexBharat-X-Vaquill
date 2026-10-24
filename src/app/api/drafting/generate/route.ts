// POST /api/drafting/generate {templateId, values, extra?, email?, allowMissing?} -> a streamed draft (newline-delimited JSON):
//   {type:"start"} {type:"plan"} {type:"checklist"} {type:"basis"} {type:"note"} {type:"section_start"} {type:"delta"} {type:"section_done"} {type:"section_failed"}
//   {type:"saved", draftId, warnings} {type:"email", status} {type:"done"} | {type:"error", code, message}
// Limits per browser (src/config/drafting-limits.json). The email address, if given and Resend is set up, is used once to send the "ready" message and is never stored.
import { dbConfigured } from "@/lib/acts/db";
import { AiError, aiConfigured } from "@/lib/ai";
import limitConfig from "@/config/drafting-limits.json";
import { evaluateLimits, readLimits } from "@/lib/chat/limits.mjs";
import { getTemplate } from "@/lib/drafting/catalog";
import { emailConfigured, sendReadyEmail, validEmail } from "@/lib/drafting/email.mjs";
import { runDraft } from "@/lib/drafting/generate";
import { bidOf, envOf, json } from "@/lib/drafting/http";
import { validateInput } from "@/lib/drafting/templates.mjs";
import { bump } from "@/lib/insights/server";
import { countDraft, countDrafts, createDraft, draftUsage, uncountDraft } from "@/lib/drafting/store";

export const maxDuration = 300;

export async function POST(req: Request) {
  const bid = bidOf(req);
  if (!bid) return json({ error: "No browser id." }, 400);
  const body = (await req.json().catch(() => null)) as { templateId?: unknown; values?: unknown; extra?: unknown; email?: unknown; allowMissing?: unknown } | null;
  const template = getTemplate(body?.templateId);
  if (!template) return json({ error: "Unknown template." }, 404);
  const values: Record<string, string> = {};
  if (body?.values && typeof body.values === "object") for (const [k, v] of Object.entries(body.values as Record<string, unknown>)) if (typeof v === "string" || typeof v === "number") values[k] = String(v);
  const extra = typeof body?.extra === "string" ? body.extra.slice(0, 2000) : "";
  const { errors } = validateInput(template, values);
  const missingOnly = Object.values(errors).every((m) => m === "Required.");
  if (Object.keys(errors).length && !(body?.allowMissing === true && missingOnly)) return json({ error: "Some details need fixing.", errors }, 422);
  if (!dbConfigured()) return json({ error: "Drafting is not set up yet (no database)." }, 503);
  if (!aiConfigured("drafting")) return json({ error: "Drafting is not set up yet (no model key)." }, 503);
  const email = emailConfigured(envOf()) && typeof body?.email === "string" && validEmail(body.email) ? body.email.trim() : null;   // used below, never stored

  const lim = readLimits(limitConfig, envOf(), "DRAFT_LIMIT");
  try {
    const verdict = evaluateLimits(await draftUsage(bid), lim, "drafts");
    if (!verdict.allowed) { bump("limit_hit", `draft_${verdict.reason}`); return json({ error: verdict.message, reason: verdict.reason }, 429); }
    if ((await countDrafts(bid)) >= limitConfig.maxSaved) return json({ error: `You have ${limitConfig.maxSaved} saved drafts, the most this browser can keep. Delete one to make room.`, reason: "saved" }, 409);
  } catch { return json({ error: "Drafting could not check its limits. Please try again." }, 503); }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* client went away: generation still finishes and is saved */ } };
      let counted = false;
      const t0 = Date.now();
      try {
        await countDraft(bid); counted = true;
        send({ type: "start" });
        const r = await runDraft({ template, values, extra, send });
        const id = await createDraft(bid, { title: r.title, templateId: template.id, fields: values, extra: extra || null, basis: r.basis, checklist: r.checklist, sections: r.sections, warnings: r.warnings, doc: r.doc, model: r.model });
        send({ type: "saved", draftId: id, warnings: r.warnings, basis: r.basis, failed: r.sections.filter((s) => s.status === "failed").map((s) => s.id) });
        if (email) {
          const link = `${new URL(req.url).origin}/workspace/drafting/${id}`;
          const sent = await sendReadyEmail({ env: envOf(), to: email, title: r.title, link });
          send({ type: "email", status: sent.ok ? "sent" : "failed" });
        }
        bump("draft", template.id); bump("answer_time", "draft", Date.now() - t0);
        send({ type: "done" }); controller.close();
      } catch (e) {
        if (counted) await uncountDraft(bid).catch(() => null);
        const busy = e instanceof AiError && ["rate_limit", "unavailable", "timeout"].includes(e.kind);
        if (busy) bump("model_busy", "drafting");
        send({ type: "error", code: busy ? "busy" : "failed", message: busy ? "Busy, try again in a minute. Your draft was not counted." : "Something went wrong and your draft was not counted. Please try again." });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { "Cache-Control": "no-store", "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
