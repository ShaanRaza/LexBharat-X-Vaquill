export type Pair = { old: string; new: string; label?: string };
export function pairFor(title: string, pairs: Pair[]): Pair | null;
export function currentLawFirst<H extends { actTitle: string; actStatus?: string | null }>(hits: H[], all: H[], pairs: Pair[], opts?: { k?: number; want?: number; keyOf?: (h: H) => string }): (H & { replacedBy?: string })[];
export const REPLACED_ADDENDUM: string;
