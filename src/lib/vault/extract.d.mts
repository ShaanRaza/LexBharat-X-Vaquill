export type Extracted = { pages: string[] | null; text: string; pageCount: number | null; scanned: boolean; reason: string; noPages?: boolean };
export function extractText(kind: "pdf" | "docx" | "txt", bytes: Uint8Array | ArrayBuffer, opts?: { scannedMinCharsPerPage?: number }): Promise<Extracted>;
