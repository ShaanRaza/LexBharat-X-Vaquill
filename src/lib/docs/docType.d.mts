export type DocRef = { title?: string | null; category?: string | null; department?: string | null; actId?: string | null; year?: number | null };
export type DocType = { type: "constitution" | "act" | "rules" | "regulations" | "instrument"; unit: string; units: string };
export const INDIA_CODE_HOME: string;
export function docTypeOf(doc?: DocRef): DocType;
export function unitWord(number: string | number, doc?: DocRef): string;
export function unitsWord(doc?: DocRef): string;
export function sourceInfo(doc?: DocRef, url?: string | null): { url: string; label: string } | null;
export function displayTitle(title: string | null | undefined, doc?: DocRef): string;
