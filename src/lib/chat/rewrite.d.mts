export const REWRITE_SYSTEM: string;
export const STATUTORY_ADDENDUM: string;
export function buildRewritePrompt(o: { question: string; history?: { role: string; content: string }[]; docContext?: string; statutory?: boolean }): { system: string; messages: { role: "user"; content: string }[] };
export function parseRewrite(raw: string, question?: string): string[];
export function mergeRanked(lists: string[][], limit: number, first?: string[]): string[];
