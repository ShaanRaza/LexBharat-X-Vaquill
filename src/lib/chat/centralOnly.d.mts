export function centralNames(acts: ({ category?: string | null; actTitle?: string | null } | null | undefined)[]): Set<string>;
export function withoutStateCopies<H extends { category?: string | null; actTitle: string }>(hits: H[], names: Set<string>, statePicked?: boolean): H[];
