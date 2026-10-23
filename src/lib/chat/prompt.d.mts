export type PromptSource = { n: number; actTitle: string; year?: number | null; state?: string | null; inForce?: boolean; number: string | null; heading?: string | null; text: string };
export const SOURCE_CHARS: number, MAX_SOURCES: number, HISTORY_TURNS: number, SYSTEM_PROMPT: string, CHECK_SYSTEM: string;
export function sourceBlock(s: PromptSource): string;
export function buildChatPrompt(o: { question: string; history?: { role: "user" | "assistant"; content: string }[]; sources: PromptSource[] }): { system: string; messages: { role: "user" | "assistant"; content: string }[] };
export function retrievalQuery(question: string, history?: { role: string; content: string }[]): string;
export function buildCheckPrompt(o: { question: string; answer: string; sources: PromptSource[] }): { system: string; messages: { role: "user" | "assistant"; content: string }[] };
export const CHECK_LABELS: Record<"supported" | "partial" | "check", string>;
export function parseCheck(raw: string): { label: "supported" | "partial" | "check"; unsupported: string[]; unreadable?: boolean };
