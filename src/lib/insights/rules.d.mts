export const FEATURES: string[], VOTES: string[], REASONS: string[], METRICS: string[];
export const MAX_COMMENT: number;
export type FeedbackInput = { feature: "chat" | "draft" | "review"; vote: "up" | "down"; itemId: string; reasons: string[]; comment: string };
export function validateFeedback(body: unknown): { ok: true; value: FeedbackInput } | { ok: false; error: string };
export function csvCell(v: unknown): string;
export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string;
export function ratio(up: number, down: number): { up: number; down: number; total: number; upPct: number | null };
export type DayRow = { day: string; visits: number; chats: number; drafts: number; reviews: number; uploads: number; scans: number; limits: number; busy: number; answers: number; answerMs: number; visitsByPage: Record<string, number>; draftsByTemplate: Record<string, number>; avgAnswerSec: number | null };
export function byDay(rows: { day: string; metric: string; key: string; n: number | string; sum_ms?: number | string }[]): DayRow[];
