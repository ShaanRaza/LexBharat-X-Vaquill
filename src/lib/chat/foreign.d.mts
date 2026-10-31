export function foreignLaw(question: string): { terms: string[] } | null;
export const FOREIGN_FIRST: string;
export const RELATED_LABEL: string;
export const FOREIGN_NOTE: string;
export function isForeignNotFound(answer: string): boolean;
export const FOREIGN_ADDENDUM: string;
export function enforceForeign(answer: string, info: { terms: string[] }, sources?: { n: number; kind?: string }[]): string;
