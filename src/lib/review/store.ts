// Saved reviews in the Supabase Postgres (table review_runs in scripts/vault/vault-schema.sql), keyed to the anonymous browser id. LOGIC ONLY. Every read and write names the browser id.
import { sb } from "@/lib/vault/supabase";
import { isUuid } from "@/lib/vault/ids";
import type { LawFinding, ReviewClause, ReviewSummary } from "./prompts.mjs";

export type CitationLite = { n: number; actId: string; sectionKey: string; actTitle: string; number: string | null; heading: string | null; status: string; category: string; state: string | null; preview?: string; kind?: "doc" | "judgment"; caseId?: string; caseYear?: number; passage?: number; page?: number | null; label?: string | null };
export type UnitState = "pending" | "ok" | "failed";
export type PartState = { i: number; start: number; end: number; status: UnitState; error?: string; clauses?: ReviewClause[] };
export type ReviewResult = {
  parts: PartState[]; summary: { status: UnitState; value?: ReviewSummary; error?: string }; law: { status: UnitState; findings?: LawFinding[]; sources?: CitationLite[]; dropped?: number; reasons?: string[]; mode?: string; error?: string };
  missing: { clause: string; why: string; source: "model" | "check" }[]; risk: "low" | "medium" | "high" | null; state: string | null; usageId?: number | null; pageStarts?: number[] | null; scanPages?: number[]; models: string[];
};
export type ReviewRun = { id: string; docId: string | null; docName: string; contractType: string; side: string; status: "running" | "done" | "partial" | "failed"; result: ReviewResult | null; createdAt: string; updatedAt: string };
export type ReviewSummaryRow = Pick<ReviewRun, "id" | "docName" | "contractType" | "side" | "status" | "createdAt"> & { risk: ReviewResult["risk"] };
type Row = Record<string, unknown>;
const run = (r: Row): ReviewRun => ({ id: r.id as string, docId: (r.doc_id as string | null) ?? null, docName: r.doc_name as string, contractType: r.contract_type as string, side: r.side as string, status: r.status as ReviewRun["status"], result: (r.result as ReviewResult | null) ?? null,
  createdAt: r.created_at as string, updatedAt: r.updated_at as string });
const must = <T>(r: { data: T | null; error: { message: string } | null }): T => { if (r.error) throw new Error(r.error.message); return r.data as T; };

export async function createRun(bid: string, d: { docId: string; docName: string; contractType: string; side: string; result: ReviewResult }): Promise<string> {
  const r = must(await sb().from("review_runs").insert({ browser_id: bid, doc_id: d.docId, doc_name: d.docName, contract_type: d.contractType, side: d.side, result: d.result }).select("id")) as Row[];
  return r[0].id as string;
}
export async function getRun(bid: string, id: string): Promise<ReviewRun | null> {
  if (!isUuid(id)) return null;
  const r = must(await sb().from("review_runs").select("*").eq("id", id).eq("browser_id", bid).maybeSingle()) as Row | null;
  return r ? run(r) : null;
}
export async function saveRun(bid: string, id: string, p: { status?: ReviewRun["status"]; result?: ReviewResult }) {
  must(await sb().from("review_runs").update({ ...p, updated_at: new Date().toISOString() }).eq("id", id).eq("browser_id", bid));
}
export async function listRuns(bid: string): Promise<ReviewSummaryRow[]> {
  const rows = must(await sb().from("review_runs").select("id,doc_name,contract_type,side,status,created_at,result->risk").eq("browser_id", bid).order("created_at", { ascending: false }).limit(60)) as Row[];
  return rows.map((r) => ({ id: r.id as string, docName: r.doc_name as string, contractType: r.contract_type as string, side: r.side as string, status: r.status as ReviewRun["status"], createdAt: r.created_at as string, risk: (r.risk as ReviewResult["risk"]) ?? null }));
}
export async function countRuns(bid: string): Promise<number> { const r = await sb().from("review_runs").select("id", { count: "exact", head: true }).eq("browser_id", bid); if (r.error) throw new Error(r.error.message); return r.count ?? 0; }
export async function deleteRun(bid: string, id: string): Promise<boolean> { if (!isUuid(id)) return false; return must(await sb().from("review_runs").delete().eq("id", id).eq("browser_id", bid).select("id")).length > 0; }
