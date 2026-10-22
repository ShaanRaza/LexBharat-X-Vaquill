export const SHARDS: number;
export function tokenize(text: string | null | undefined): string[];
export function fnv(s: string): number;
export function shardOf(token: string): number;
export function caseKeys(...texts: (string | null | undefined)[]): string[];
export function caseYears(...texts: (string | null | undefined)[]): string[];
export function planQuery(q: string): { keys: string[]; words: string[] };
