export const NOT_FOUND_FIRST: RegExp;
export function openingHedge(text: string): { kind: "preamble" } | { kind: "not-found-then-answer"; sentence: string } | null;
export function answerFirst(text: string, sources?: { n: number; kind?: string }[] | null): string;
export function restsOnAct(text: string, sources: { n: number; kind?: string }[]): boolean;
export const SENT: RegExp;
export function sentences(text: string): string[];
export function relatedOnlyIfApplicable(text: string, sources: { n: number; heading?: string | null; text?: string | null }[], question: string, opts?: { min?: number }): string;
export function dedupeCitations(text: string): string;
