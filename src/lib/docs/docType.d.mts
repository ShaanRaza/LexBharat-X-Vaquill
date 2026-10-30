export type DocRef = { title?: string | null; category?: string | null; department?: string | null; actId?: string | null; year?: number | null };
export type DocType = { type: "constitution" | "act" | "rules" | "regulations" | "instrument"; unit: string; units: string };
export const INDIA_CODE_HOME: string;
export const INDIA_CODE: RegExp;
export function fixIndiaCodeLinks(text: string | null | undefined): string;
export function indiaCodeSearchUrl(title: string | null | undefined): string;
export function liveIndiaCodeUrl(url: string, title?: string | null): string;
export function liveIndiaCodeUrl(url: string | null | undefined, title?: string | null): string | null | undefined;
export function docTypeOf(doc?: DocRef): DocType;
export function unitWord(number: string | number, doc?: DocRef): string;
export function unitsWord(doc?: DocRef): string;
export function sourceInfo(doc?: DocRef, url?: string | null): { url: string; label: string } | null;
export function displayTitle(title: string | null | undefined, doc?: DocRef): string;

export function libraryHome(doc?: DocRef): { label: string; href: string };
export function caseTitle(title: string | null | undefined): string;
