export function collapseLetterSpacing(line: string): { text: string; ambiguous: boolean };
export function stripMarkdown(s: string): string;
export type DisplayBlock = { type: "heading" | "p"; text: string };
export function toDisplayBlocks(raw: string, opts?: { lines?: boolean }): DisplayBlock[];
export function cleanHeading(s: string | null | undefined): string | null;
export function fixQuoteMarks(s: string | null | undefined): string;
export function stripJunk(raw: string | null | undefined): string;
export function tidySpacing(s: string): string;
export type CleanPart = { t: "text"; v: string } | { t: "mark"; n: number };
export function cleanParts(raw: string | null | undefined, vocab?: Set<string>): CleanPart[];
export function cleanPlain(raw: string | null | undefined, vocab?: Set<string>): string;
export function previewText(raw: string | null | undefined, max?: number): string;
export { amendParts, vocabOf } from "./amend.mjs";
export function cleanLabel(s: string | null | undefined): string;
export function stripTrailingHeadings(raw: string | null | undefined): string;

export function joinHeading(label: string, heading: string | null | undefined, sep?: string): string;
