// Chat storage in the main Neon database (tables in scripts/chat/chat-schema.sql), keyed to the anonymous browser id. LOGIC ONLY. Every read and write checks the browser id,
// so one browser cannot open another's chat even with its id.
import { query } from "@/lib/acts/db";
import { addUsage, countersConfigured, removeUsage, usageCounts } from "@/lib/limits/counters";

export type Citation = { n: number; actId: string; sectionKey: string; actTitle: string; number: string | null; heading: string | null; status: string; category: string; state: string | null; preview?: string;
  /** "doc": a passage of the user's own document (actId/sectionKey are then empty; actTitle holds the document name); absent: a section of an Act */
  kind?: "doc" | "judgment"; docId?: string; /** "judgment": a passage of a Supreme Court judgment (actTitle holds the case title, label its citation) */ caseId?: string; caseYear?: number; passage?: number; docName?: string; page?: number | null; label?: string | null; /** the page was read from a scan: shown as "Read from scan — check the original" */ scan?: boolean };
export type CheckResult = { label: "supported" | "partial" | "check" | "not_found"; unsupported: string[]; missing?: string[]; unavailable?: boolean; cutOff?: boolean };
export type StoredMessage = { id: number; role: "user" | "assistant"; content: string; citations: Citation[] | null; check: CheckResult | null; model: string | null; createdAt: string };
export type ChatSummary = { id: string; title: string; updatedAt: string };

export const isChatId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
export const chatTitle = (q: string) => { const t = q.replace(/\s+/g, " ").trim(); return t.length > 60 ? t.slice(0, 57).replace(/\s+\S*$/, "") + "…" : t; };

export async function createChat(browserId: string, title: string): Promise<string> {
  const r = await query<{ id: string }>("INSERT INTO chats (browser_id, title) VALUES ($1, $2) RETURNING id", [browserId, title]);
  return r[0].id;
}
export async function ownsChat(browserId: string, chatId: string): Promise<boolean> {
  return (await query("SELECT 1 FROM chats WHERE id = $1 AND browser_id = $2", [chatId, browserId])).length > 0;
}
export async function addMessage(chatId: string, m: { role: "user" | "assistant"; content: string; citations?: Citation[] | null; check?: CheckResult | null; model?: string | null }): Promise<number> {
  const r = await query<{ id: string }>("INSERT INTO chat_messages (chat_id, role, content, citations, check_result, model) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    [chatId, m.role, m.content, m.citations ? JSON.stringify(m.citations) : null, m.check ? JSON.stringify(m.check) : null, m.model ?? null]);
  await query("UPDATE chats SET updated_at = now() WHERE id = $1", [chatId]);
  return Number(r[0].id);
}
export async function deleteMessage(id: number) { await query("DELETE FROM chat_messages WHERE id = $1", [id]); }
export async function deleteChat(browserId: string, chatId: string): Promise<boolean> {
  return (await query("DELETE FROM chats WHERE id = $1 AND browser_id = $2 RETURNING id", [chatId, browserId])).length > 0;
}
export async function listChats(browserId: string, limit = 50): Promise<ChatSummary[]> {
  return query<ChatSummary>(`SELECT id, title, updated_at AS "updatedAt" FROM chats WHERE browser_id = $1 ORDER BY updated_at DESC LIMIT ${Math.floor(limit)}`, [browserId]);
}
export async function getChat(browserId: string, chatId: string): Promise<{ id: string; title: string; messages: StoredMessage[] } | null> {
  const c = await query<{ id: string; title: string }>("SELECT id, title FROM chats WHERE id = $1 AND browser_id = $2", [chatId, browserId]);
  if (!c.length) return null;
  const messages = await query<StoredMessage>(`SELECT id::int, role, content, citations, check_result AS "check", model, created_at AS "createdAt" FROM chat_messages WHERE chat_id = $1 ORDER BY id`, [chatId]);
  return { ...c[0], messages };
}
/** The last few turns (plain text only) for the model's context. */
export async function recentTurns(chatId: string, limit = 8): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const r = await query<{ role: "user" | "assistant"; content: string }>("SELECT role, content FROM (SELECT id, role, content FROM chat_messages WHERE chat_id = $1 ORDER BY id DESC LIMIT " + Math.floor(limit) + ") t ORDER BY id", [chatId]);
  return r;
}

// ---- usage counters for the limits (India time)
const TODAY = "(now() AT TIME ZONE 'Asia/Kolkata')::date";
async function legacyUsageFor(browserId: string): Promise<{ day: number; week: number; month: number }> {
  const r = await query<{ day: string; week: string; month: string }>(
    `SELECT coalesce(sum(count) FILTER (WHERE browser_id = $1 AND day = ${TODAY}), 0) AS day,
            coalesce(sum(count) FILTER (WHERE browser_id = $1 AND day > ${TODAY} - 7), 0) AS week,
            coalesce(sum(count) FILTER (WHERE day >= date_trunc('month', ${TODAY})::date), 0) AS month
     FROM chat_usage WHERE day > ${TODAY} - 40`, [browserId]);
  return { day: Number(r[0].day), week: Number(r[0].week), month: Number(r[0].month) };
}
/** Questions asked: this browser today / this week, and all browsers this month. Kept in Supabase (shared by every server instance); the old Neon table is only used when Supabase is not configured. */
export async function usageFor(browserId: string): Promise<{ day: number; week: number; month: number }> { return countersConfigured() ? usageCounts(browserId, "chat") : legacyUsageFor(browserId); }
/** Counts one question; returns an id to hand back to uncountQuestion (null with the old Neon counters). */
export async function countQuestion(browserId: string): Promise<number | null> {
  if (countersConfigured()) return addUsage(browserId, "chat");
  await query(`INSERT INTO chat_usage (browser_id, day, count) VALUES ($1, ${TODAY}, 1) ON CONFLICT (browser_id, day) DO UPDATE SET count = chat_usage.count + 1`, [browserId]);
  return null;
}
export async function uncountQuestion(browserId: string, id?: number | null) {
  if (id) { await removeUsage(id); return; }
  await query(`UPDATE chat_usage SET count = greatest(count - 1, 0) WHERE browser_id = $1 AND day = ${TODAY}`, [browserId]);
}
