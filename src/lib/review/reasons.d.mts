export const NOT_A_CONTRACT: string;
export class StepError extends Error { code: "no_clauses" | "bad_reply"; constructor(code: "no_clauses" | "bad_reply"); }
export function reasonFor(e: unknown): string;
export function looksLikeContract(text: string): { ok: boolean; score: number; invoiceHits: number };
export function isTransientReason(reason: string | undefined): boolean;
