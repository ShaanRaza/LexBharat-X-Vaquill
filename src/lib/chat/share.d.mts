export function namesAct(query: string, actTitle: string): boolean;
export function ensureActShare(merged: string[], lists: string[][], queries: string[], actOf: (key: string) => { id: string; title: string } | null | undefined, opts?: { limit?: number; min?: number; protect?: string[] }): string[];
