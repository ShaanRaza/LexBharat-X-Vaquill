export function collapseLetterSpacing(line: string): { text: string; ambiguous: boolean };
export function stripMarkdown(s: string): string;
export type DisplayBlock = { type: "heading" | "p"; text: string };
export function toDisplayBlocks(raw: string, opts?: { lines?: boolean }): DisplayBlock[];
export function cleanHeading(s: string | null | undefined): string | null;
