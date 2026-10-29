export function dedupeCopies<H extends { actTitle?: string; title?: string; number?: string | null; copies?: number }>(hits: H[]): H[];
