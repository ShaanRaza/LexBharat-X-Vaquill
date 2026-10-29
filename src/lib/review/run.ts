// Running a contract review, one resumable step at a time. LOGIC ONLY. Steps: each part of the contract (clauses + risks), then the summary, then the Indian-law points. A part or step that fails is kept as
// failed ("Not reviewed, retry") and the rest is untouched. The law points rest only on sections retrieved from our Acts; anything uncited is dropped (src/lib/review/prompts.mjs parseLaw).
import { dbConfigured } from "@/lib/app-db";
import { bump } from "@/lib/insights/server";
import { AiError, completeAi } from "@/lib/ai";
import { citationOf, retrieveSources } from "@/lib/chat/retrieve";
import limitConfig from "@/config/review-limits.json";
import { lawPrompt, lawPlanNotes, mergeMissing, overallRisk, parseClauses, parseLaw, parseSummary, partPrompt, summaryPrompt, type ReviewClause } from "./prompts.mjs";
import { StepError, reasonFor } from "./reasons.mjs";
import { lawPlan, missingClauses, splitParts } from "./rules.mjs";
import { annotateClauses } from "./pages.mjs";
import { getRun, saveRun, type ReviewResult, type ReviewRun } from "./store";
import { getText } from "@/lib/vault/store";
import { takeLease } from "@/lib/vault/lease";

export const partChars = () => { const n = Number(process.env.REVIEW_PART_CHARS); return Number.isFinite(n) && n > 1000 ? n : limitConfig.partChars; };
const g = globalThis as unknown as { __reviewLocks?: Map<string, number> };
const locks = (g.__reviewLocks ??= new Map<string, number>());
// Why a step failed, in plain words (src/lib/review/reasons.mjs). The kind of failure is logged (never the model's text or a key) so the server log says what the user was told.
const kindOf = (e: unknown) => {
  if (e instanceof AiError && (e.kind === "rate_limit" || e.kind === "unavailable" || e.kind === "timeout")) bump("model_busy", "review");
  const x = e as { name?: string; kind?: string; code?: string; status?: number };
  console.error("[review] step failed:", x?.name ?? "error", x?.kind ?? x?.code ?? "", x?.status ?? "");
  return reasonFor(e);
};

export function newResult(text: string, type: string, pageStarts: number[] | null): ReviewResult {
  const parts = splitParts(text, partChars()).map((p) => ({ i: p.i, start: p.start, end: p.end, status: "pending" as const }));
  return { parts, summary: { status: "pending" }, law: { status: "pending" }, missing: [], risk: null, state: lawPlan(text, type).state, pageStarts, models: [] };
}
const allClauses = (r: ReviewResult): ReviewClause[] => r.parts.flatMap((p) => p.clauses ?? []);
const ref = (r: ReviewResult) => (r.parts.some((p) => p.status === "failed") ? "partial" : "done") as ReviewRun["status"];

/** Does the next unit of work (the first pending part, else the summary, else the law points). Returns the updated run. */
export async function stepReview(bid: string, id: string, retry?: number | "summary" | "law"): Promise<{ run: ReviewRun | null; busy?: boolean }> {
  const run = await getRun(bid, id); if (!run?.result) return { run: null };
  if (!takeLease(locks, id)) return { run, busy: true };
  try {
    const res = run.result, tx = run.docId ? await getText(bid, run.docId) : null;
    if (!tx) { res.parts.forEach((p) => { if (p.status === "pending") { p.status = "failed"; p.error = "The document is no longer in the Vault, so it cannot be reviewed."; } }); await saveRun(bid, id, { status: "failed", result: res }); return { run: { ...run, status: "failed" } }; }
    const text = tx.body;
    if (typeof retry === "number") { const p = res.parts.find((x) => x.i === retry); if (p) { p.status = "pending"; delete p.error; } res.summary = { status: "pending" }; res.law = { status: "pending" }; }
    if (retry === "summary") res.summary = { status: "pending" };
    if (retry === "law") res.law = { status: "pending" };
    const part = res.parts.find((p) => p.status === "pending");
    if (part) {
      const piece = text.slice(part.start, part.end).trim();
      try {
        const out = await completeAi("review", { ...partPrompt({ type: run.contractType, side: run.side, partText: piece, n: part.i + 1, of: res.parts.length }), json: true });
        const clauses = parseClauses(out.text, piece);
        if (!clauses) throw new StepError("bad_reply");
        if (!clauses.length) throw new StepError("no_clauses");
        part.clauses = annotateClauses(clauses, text, part, tx.pageStarts, res.scanPages); part.status = "ok"; if (out.model && !res.models.includes(out.model)) res.models.push(out.model);
      } catch (e) { part.status = "failed"; part.error = kindOf(e); }
    } else if (res.summary.status === "pending") {
      const clauses = allClauses(res);
      if (!clauses.length) { res.summary = { status: "failed", error: "No part of the contract could be reviewed." }; }
      else {
        const rules = missingClauses(run.contractType, text);
        try {
          const out = await completeAi("review", { ...summaryPrompt({ type: run.contractType, side: run.side, headText: text.slice(0, 3500), clauses }), json: true });
          const s = parseSummary(out.text); if (!s) throw new StepError("bad_reply");
          res.summary = { status: "ok", value: s }; res.missing = mergeMissing(s.missing, rules); res.risk = overallRisk(s.overallRisk, clauses); if (out.model && !res.models.includes(out.model)) res.models.push(out.model);
        } catch (e) { res.summary = { status: "failed", error: kindOf(e) }; res.missing = mergeMissing([], rules); res.risk = overallRisk(null, clauses); }
      }
    } else if (res.law.status === "pending") {
      const clauses = allClauses(res), flagged = clauses.filter((c) => c.risk !== "acceptable");
      const plan = lawPlan(text, run.contractType, [...new Set(clauses.flatMap((c) => c.topics))]);
      try {
        if (!dbConfigured()) throw new Error("no law database");
        const q = `${run.contractType} contract India: ${plan.topics.map((t) => t.label).join(", ") || "key terms"}`;
        const ret = await retrieveSources(q, [], plan.queries, 14, plan.lookups);
        if (!ret.sources.length) { res.law = { status: "ok", findings: [], sources: [], dropped: 0, mode: ret.searchMode }; }
        else {
          const out = await completeAi("review", { ...lawPrompt({ type: run.contractType, side: run.side, issues: flagged.slice(0, 14), sources: ret.sources, notes: lawPlanNotes(plan, run.contractType, res.missing) }), json: true });
          const l = parseLaw(out.text, ret.sources); if (!l) throw new StepError("bad_reply");
          res.law = { status: "ok", findings: l.findings, dropped: l.dropped, reasons: l.reasons, sources: ret.sources.map(citationOf), mode: ret.searchMode }; if (out.model && !res.models.includes(out.model)) res.models.push(out.model);
        }
      } catch (e) { res.law = { status: "failed", error: e instanceof AiError || e instanceof StepError ? kindOf(e) : "The Indian-law database could not be searched right now. The rest of the review is not affected." }; }
    }
    const pending = res.parts.some((p) => p.status === "pending") || res.summary.status === "pending" || res.law.status === "pending";
    const status: ReviewRun["status"] = pending ? "running" : res.parts.every((p) => p.status === "failed") ? "failed" : (res.summary.status === "failed" || res.law.status === "failed" ? "partial" : ref(res));
    await saveRun(bid, id, { status, result: res });
    return { run: { ...run, status, result: res } };
  } finally { locks.delete(id); }
}
