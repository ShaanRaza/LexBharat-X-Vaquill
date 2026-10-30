export type MarkGroup = "clean" | "ambiguous";
export type CleanResult = { text: string; changed: boolean; kinds: Record<string, number> };
export type Found = { kind: string; group: MarkGroup; index: number; match: string };
export const CLEAN_RULES: { kind: string }[];
export const AMBIGUOUS_RULES: { kind: string; note: string }[];
export function cleanMarks(input: string): CleanResult;
export function findMarks(text: string): Found[];
export function otherBrackets(text: string): { key: string; example: string; index: number }[];
export function contextAround(text: string, index: number, length: number, radius?: number): string;
