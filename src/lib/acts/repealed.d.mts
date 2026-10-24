export type RepealedTable = Record<string, { name: string; newActId: string; newName: string; short: string } | string>;
export function repealedNote(actId: string | null | undefined, table: RepealedTable): { text: string; short: string; newName: string; name: string; href: string } | null;
