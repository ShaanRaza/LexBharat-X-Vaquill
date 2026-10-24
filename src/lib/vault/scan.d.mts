export const SCAN_LABEL: string, UNREADABLE_PAGE: string, BLANK_PAGE: string;
export function scanPrompt(n: number): string;
export function parseScanOutput(text: string, n: number): (string | null)[];
export function planScan(scanPages: number[], max: number): { take: number[]; skipped: number };
export function mergePages(extracted: string[], scanMap: Map<number, string>): string[];
