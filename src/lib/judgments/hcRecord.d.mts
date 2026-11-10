export const HC_PREFIXES: Record<string, string>;
export function courtOfId(id: string | null | undefined): string | null;
export function regTitle(raw: string | null | undefined): { title: string | null; caseNumber: string | null };
export function isRegForm(t: string): boolean;
export const HC_FIELDS: string[];
export function pickHcFields(row: Record<string, unknown>): Record<string, unknown>;
