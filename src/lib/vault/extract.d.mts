export type Extracted = { pages: string[] | null; text: string; pageCount: number | null; scanned: boolean; /** image-only pages (1-based) that need the model-based reader */ scanPages: number[]; reason: string; noPages?: boolean };
export function extractText(kind: "pdf" | "docx" | "txt" | "jpg" | "png", bytes: Uint8Array | ArrayBuffer, opts?: { scannedMinCharsPerPage?: number }): Promise<Extracted>;
/** Reads pages `from`... (1-based) of a PDF, stopping after `maxPages` or `budgetMs` (at least one page). `total` is 0 and `reason` set when the file can't be read. */
export function readPdfPages(bytes: Uint8Array | ArrayBuffer, from: number, opts?: { maxPages?: number; budgetMs?: number }): Promise<{ total: number; pages: string[]; reason: string }>;
