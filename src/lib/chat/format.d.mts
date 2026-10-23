export type Block = { type: "p"; text: string } | { type: "ul" | "ol"; items: string[] };
export function toBlocks(text: string): Block[];
export function previewOf(text: string, max?: number): string;
