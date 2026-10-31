export const MIN_TOKENS: number, MIN_ODD: number, MIN_SHARE: number, SAMPLE_CHARS: number;
export function wordsOf(text: string | null | undefined): string[];
export function scanJunkScore(text: string | null | undefined, known?: Set<string>): { tokens: number; lower: number; odd: number; share: number } | null;
export function looksLikeScanJunk(text: string | null | undefined, known?: Set<string>): boolean;
