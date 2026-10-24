import type { Tone } from "@/components/kit";

// Words and tones for the review pages. A tone is a meaning (the kit decides the colour), so a reskin changes nothing here.
export const RISK_BADGE: Record<"low" | "medium" | "high", { tone: Tone; text: string }> = { low: { tone: "complete", text: "Low risk" }, medium: { tone: "warn", text: "Medium risk" }, high: { tone: "bad", text: "High risk" } };
export const CLAUSE_BADGE: Record<"acceptable" | "negotiate" | "escalate", { tone: Tone; text: string }> = { acceptable: { tone: "complete", text: "Acceptable" }, negotiate: { tone: "warn", text: "Negotiate" }, escalate: { tone: "bad", text: "Escalate" } };
export const STATUS_TEXT: Record<"running" | "done" | "partial" | "failed", string> = { running: "In progress", done: "Done", partial: "Partly done", failed: "Failed" };
