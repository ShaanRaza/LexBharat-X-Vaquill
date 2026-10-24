export type VaultKind = "pdf" | "docx" | "txt";
export const KINDS: Record<VaultKind, { label: string; mime: string; ext: string[] }>;
export const ACCEPT: string; export const MB: number; export const SCANNED_MESSAGE: string;
export function kindFromName(name: string): VaultKind | null;
export function sniffKind(bytes: Uint8Array | ArrayBuffer): VaultKind | null;
export function cleanName(name: string): string; export function storageName(name: string): string;
export type VaultLimits = { maxFileMb: number; maxDocs: number; maxTotalMb: number; bucket: string; signedUrlSeconds: number; uploadWaitMinutes: number; chunkChars: number; chunkOverlap: number; maxChunks: number; embedBatch: number; embedMaxChars: number; embedMinGapMs: number; scannedMinCharsPerPage: number };
export function checkUpload(f: { name: string; size: number }, existing: { sizeBytes: number }[], limits: Pick<VaultLimits, "maxFileMb" | "maxDocs" | "maxTotalMb">): { ok: boolean; kind?: VaultKind; message: string };
export function readVaultLimits(config: Record<string, unknown>, env?: Record<string, string | undefined>): VaultLimits;
