// Vault upload rules. PURE logic: no storage, no network.
export const KINDS = { pdf: { label: "PDF", mime: "application/pdf", ext: [".pdf"] }, docx: { label: "Word (.docx)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: [".docx"] }, txt: { label: "Text", mime: "text/plain", ext: [".txt"] } };
export const ACCEPT = ".pdf,.docx,.txt";
export const MB = 1024 * 1024;

/** The kind a file name claims (by extension), or null. */
export function kindFromName(name) {
  const n = String(name).toLowerCase();
  return Object.entries(KINDS).find(([, v]) => v.ext.some((e) => n.endsWith(e)))?.[0] ?? null;
}
/** The kind the BYTES are, whatever the name says: %PDF header; a zip holding word/document.xml; or text with no NUL bytes. Returns null when it is none of them. */
export function sniffKind(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";   // %PDF
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 3 || b[2] === 5)) {
    const head = new TextDecoder("latin1").decode(b.subarray(0, Math.min(b.length, 4096)));   // file names sit in the zip's local headers; a .docx starts with [Content_Types].xml or word/
    return /word\//.test(head) || /\[Content_Types\]\.xml/.test(head) ? "docx" : null;
  }
  const sample = b.subarray(0, Math.min(b.length, 8192));
  if (sample.length && !sample.includes(0)) { try { new TextDecoder("utf-8", { fatal: true }).decode(sample.subarray(0, sample.length - 3)); return "txt"; } catch { return null; } }
  return null;
}
/** A file name safe for the display list and the storage key: no path parts or control characters. */
export const cleanName = (name) => String(name).replace(/[\\/\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "document";
export const storageName = (name) => cleanName(name).normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(-80) || "document";

/** May this browser add a file? existing: [{ sizeBytes }]. Returns { ok, message }. Messages are shown as they are. */
export function checkUpload({ name, size }, existing, limits) {
  const kind = kindFromName(name);
  if (!kind) return { ok: false, message: "Only PDF, Word (.docx) and text (.txt) files can be added." };
  if (!Number.isFinite(size) || size <= 0) return { ok: false, message: "That file is empty." };
  if (size > limits.maxFileMb * MB) return { ok: false, message: `That file is ${(size / MB).toFixed(1)} MB. The most is ${limits.maxFileMb} MB per file.` };
  if (existing.length >= limits.maxDocs) return { ok: false, message: `You have ${existing.length} documents, the most this browser can keep is ${limits.maxDocs}. Delete one first.` };
  const total = existing.reduce((a, d) => a + Number(d.sizeBytes), 0);
  if (total + size > limits.maxTotalMb * MB) return { ok: false, message: `This would take the Vault past ${limits.maxTotalMb} MB (it holds ${(total / MB).toFixed(1)} MB). Delete something first.` };
  return { ok: true, kind, message: "" };
}

/** Limits from config with env overrides (bad values keep the configured number). */
export function readVaultLimits(config, env = {}) {
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
  return { ...config, maxDocs: Math.floor(num(env.VAULT_MAX_DOCS, config.maxDocs)), maxTotalMb: num(env.VAULT_MAX_TOTAL_MB, config.maxTotalMb), maxFileMb: num(env.VAULT_MAX_FILE_MB, config.maxFileMb),
    bucket: env.VAULT_BUCKET?.trim() || config.bucket, signedUrlSeconds: Math.floor(num(env.VAULT_SIGNED_URL_SECONDS, config.signedUrlSeconds)), embedMinGapMs: Math.floor(num(env.VAULT_EMBED_MIN_GAP_MS, config.embedMinGapMs)),
    embedBatch: Math.floor(num(env.VAULT_EMBED_BATCH, config.embedBatch)) };
}
export const SCANNED_MESSAGE = "This looks like a scanned document. Text reading for scans isn't available yet.";
