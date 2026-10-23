import type { Block } from "./docmodel.mjs";
export const DISCLAIMER: string;
export function fontRuns<F>(text: string, chain: { font: F; has: Set<number> }[]): { text: string; font: F }[];
export function buildDocx(blocks: Block[], meta?: { title?: string }): Promise<Buffer>;
export function buildPdf(blocks: Block[], meta?: { title?: string }): Promise<Uint8Array>;
