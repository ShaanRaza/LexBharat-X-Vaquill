// Feedback and usage counters on the Supabase free project (tables in scripts/w8/w8-schema.sql). Server-only. Nothing here may break a feature: counters are best-effort and never throw;
// when the W8 tables are not created yet they quietly do nothing. The browser id is only ever stored as a hash; no IP address and no document text is stored.
import { createHash } from "node:crypto";
import { query, dbConfigured } from "@/lib/acts/db";
import { sb, vaultConfigured } from "@/lib/vault/supabase";
import { getRun } from "@/lib/review/store";
import { getDraft } from "@/lib/drafting/store";
import { rateCheck } from "@/lib/limits/counters";
import { REASONS, type FeedbackInput } from "./rules.mjs";

const salt = () => process.env.ACCESS_COOKIE_SECRET?.trim() || "dev-salt";
/** A one-way hash of the browser id (the id itself is never stored in the feedback and usage tables). */
export const browserHash = (bid: string) => createHash("sha256").update(`${salt()}:${bid}`).digest("hex").slice(0, 32);
export const insightsConfigured = () => vaultConfigured();

/** Adds one to a day counter. Never waits for the result and never throws. */
export function bump(metric: string, key = "", ms = 0): void {
  if (!insightsConfigured()) return;
  void (async () => { try { await sb().rpc("bump_usage", { p_metric: metric, p_key: key, p_ms: Math.round(ms) }); } catch { /* counters are best-effort */ } })();
}
/** Counts a page visit once per browser per page per day. */
export async function noteVisit(bid: string, page: string): Promise<void> {
  if (!insightsConfigured()) return;
  try { await sb().rpc("note_visit", { p_hash: browserHash(bid), p_page: page }); } catch { /* best-effort */ }
}

type Snapshot = { question?: string; answer?: string; citations?: string[]; title?: string; template?: string; contractType?: string; side?: string; risk?: string | null } | null;
/** What was rated, read from the server's own copy (never from the browser): the question, answer and the labels of the cited sections; for drafts and reviews only names, never document text. */
async function snapshotFor(bid: string, f: FeedbackInput): Promise<{ snapshot: Snapshot; model: string | null; found: boolean }> {
  try {
    if (f.feature === "chat") {
      if (!dbConfigured() || !/^\d{1,12}$/.test(f.itemId)) return { snapshot: null, model: null, found: false };
      const rows = await query<{ content: string; citations: { actTitle: string; number: string | null; docName?: string }[] | null; model: string | null; chat_id: string; id: string }>(
        `SELECT m.id, m.chat_id, m.content, m.citations, m.model FROM chat_messages m JOIN chats c ON c.id = m.chat_id WHERE m.id = $1 AND m.role = 'assistant' AND c.browser_id = $2`, [f.itemId, bid]);
      if (!rows.length) return { snapshot: null, model: null, found: false };
      const q = await query<{ content: string }>(`SELECT content FROM chat_messages WHERE chat_id = $1 AND role = 'user' AND id < $2 ORDER BY id DESC LIMIT 1`, [rows[0].chat_id, f.itemId]);
      return { found: true, model: rows[0].model, snapshot: { question: q[0]?.content, answer: rows[0].content, citations: (rows[0].citations ?? []).map((c) => `${c.docName ?? c.actTitle}${c.number ? `, ${c.number}` : ""}`) } };
    }
    if (f.feature === "draft") {
      const d = await getDraft(bid, f.itemId);
      return d ? { found: true, model: d.model, snapshot: { title: d.title, template: d.templateId } } : { snapshot: null, model: null, found: false };
    }
    const r = await getRun(bid, f.itemId);
    return r ? { found: true, model: r.result?.models?.join(", ") || null, snapshot: { contractType: r.contractType, side: r.side, risk: r.result?.risk ?? null } } : { snapshot: null, model: null, found: false };
  } catch { return { snapshot: null, model: null, found: false }; }
}

export type SaveOutcome = { ok: true; vote: "up" | "down" } | { ok: false; status: number; error: string };
/** One vote per browser per item; voting again changes it. The first request adds a row; later ones update it (so the stats count the item once). */
export async function saveFeedback(bid: string, f: FeedbackInput): Promise<SaveOutcome> {
  if (!insightsConfigured()) return { ok: false, status: 503, error: "Feedback is not set up on this server yet." };
  const s = await snapshotFor(bid, f);
  if (!s.found) return { ok: false, status: 404, error: "That item was not found." };
  const { error } = await sb().from("feedback").upsert({ browser_hash: browserHash(bid), feature: f.feature, item_id: f.itemId, vote: f.vote, reasons: f.reasons.filter((r) => REASONS.includes(r)), comment: f.comment || null, model: s.model, snapshot: s.snapshot, updated_at: new Date().toISOString() }, { onConflict: "browser_hash,feature,item_id" });
  if (error) return { ok: false, status: 503, error: /relation|does not exist|schema cache/i.test(error.message) ? "Feedback is not set up yet (the W8 tables are missing)." : "Feedback could not be saved." };
  return { ok: true, vote: f.vote };
}
/** This browser's votes for some items: { [itemId]: { vote, reasons, comment } }. */
export async function myVotes(bid: string, feature: string, ids: string[]) {
  if (!insightsConfigured() || !ids.length) return {} as Record<string, { vote: "up" | "down"; reasons: string[]; comment: string }>;
  const { data } = await sb().from("feedback").select("item_id, vote, reasons, comment").eq("browser_hash", browserHash(bid)).eq("feature", feature).in("item_id", ids.slice(0, 100));
  return Object.fromEntries((data ?? []).map((r) => [r.item_id as string, { vote: r.vote as "up" | "down", reasons: (r.reasons as string[]) ?? [], comment: (r.comment as string) ?? "" }]));
}

// ---- admin
export type FeedbackRow = { id: string; feature: string; vote: string; reasons: string[]; comment: string | null; model: string | null; snapshot: Snapshot; created_at: string; updated_at: string };
export async function adminData(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const [usage, votes, down] = await Promise.all([
    sb().from("usage_daily").select("day, metric, key, n, sum_ms").gte("day", since).limit(5000),
    sb().from("feedback").select("feature, vote").limit(20000),
    sb().from("feedback").select("id, feature, vote, reasons, comment, model, snapshot, created_at, updated_at").eq("vote", "down").order("updated_at", { ascending: false }).limit(300),
  ]);
  const err = usage.error ?? votes.error ?? down.error;
  return { error: err ? (/relation|does not exist|schema cache/i.test(err.message) ? "missing" : "failed") : null, usage: (usage.data ?? []) as { day: string; metric: string; key: string; n: number; sum_ms: number }[],
    votes: (votes.data ?? []) as { feature: string; vote: string }[], down: (down.data ?? []) as FeedbackRow[] };
}
export async function allFeedback(): Promise<FeedbackRow[]> {
  const { data } = await sb().from("feedback").select("id, feature, vote, reasons, comment, model, snapshot, created_at, updated_at").order("updated_at", { ascending: false }).limit(5000);
  return (data ?? []) as FeedbackRow[];
}

// ---- free-text feedback messages (scripts/w8/w8b-feedback-messages.sql)
export const MESSAGES_PER_HOUR = 5;
export type MessageRow = { id: string; message: string; email: string | null; page: string | null; created_at: string };
/** Saves one message from the in-app Feedback form. At most MESSAGES_PER_HOUR per browser per hour (counted in Supabase, so it holds across server instances). */
export async function saveMessage(bid: string, m: { message: string; email: string; page: string }): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!insightsConfigured()) return { ok: false, status: 503, error: "Feedback is not set up on this server yet." };
  const hash = browserHash(bid), gate = await rateCheck("feedback-message", hash, MESSAGES_PER_HOUR, 3600);
  if (!gate.ok) return { ok: false, status: 429, error: `That is ${MESSAGES_PER_HOUR} messages in an hour. Please try again in ${Math.max(1, Math.ceil(gate.retryAfterSec / 60))} minutes.` };
  const { error } = await sb().from("feedback_messages").insert({ browser_hash: hash, message: m.message, email: m.email || null, page: m.page || null });
  if (error) return { ok: false, status: 503, error: /relation|does not exist|schema cache/i.test(error.message) ? "Feedback messages are not set up yet (scripts/w8/w8b-feedback-messages.sql has not been run)." : "Your message could not be saved. Please try again." };
  return { ok: true };
}
/** The newest messages for the admin page. `error` is "missing" when the table has not been created yet. */
export async function adminMessages(limit = 200): Promise<{ error: "missing" | "failed" | null; rows: MessageRow[] }> {
  const { data, error } = await sb().from("feedback_messages").select("id, message, email, page, created_at").order("created_at", { ascending: false }).limit(limit);
  return { error: error ? (/relation|does not exist|schema cache/i.test(error.message) ? "missing" : "failed") : null, rows: (data ?? []) as MessageRow[] };
}

