export type SupplementEntry = { fileName: string; actName: string; actId: string; number: string; sectionKey: string; heading: string | null; replaces: boolean; source: string; sourceUrl: string; copiedOn: string; body: string };
export type ParsedFile = { status: "pending" | "ok" | "error"; errors: string[]; entry?: SupplementEntry };
export const MIN_TEXT: number, MAX_TEXT: number;
export function sectionKeyFor(number: string): string;
export function parseSupplementFile(raw: string, fileName?: string, now?: Date): ParsedFile;
export function entryHash(e: SupplementEntry): string;
