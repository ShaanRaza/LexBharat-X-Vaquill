// Reads the text out of an uploaded file with free libraries (unpdf for PDF, mammoth for Word, plain decoding for text). No OCR: a PDF with almost no text is reported as scanned.
// Returns { pages: string[] | null, text, pageCount, scanned, reason }. `pages` is per page for a PDF; Word and text files have no page numbers (pages = null). Never throws for bad files: reason says why.
import { SCANNED_MESSAGE } from "./files.mjs";

const norm = (s) => String(s).replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");

export async function extractText(kind, bytes, { scannedMinCharsPerPage = 25 } = {}) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    if (kind === "pdf") {
      const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const r = await pdfText(pdf, { mergePages: false });
      const pages = r.text.map(norm), total = pages.join("").replace(/\s+/g, "").length;
      if (total < scannedMinCharsPerPage * Math.max(1, r.totalPages)) return { pages: null, text: "", pageCount: r.totalPages, scanned: true, reason: SCANNED_MESSAGE };
      return { pages, text: pages.join("\n\n"), pageCount: r.totalPages, scanned: false, reason: "" };
    }
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      const text = norm(r.value);
      if (!text.trim()) return { pages: null, text: "", pageCount: null, scanned: false, reason: "No text was found in this Word file." };
      return { pages: [text], text, pageCount: null, scanned: false, reason: "", noPages: true };
    }
    if (kind === "txt") {
      const text = norm(new TextDecoder("utf-8").decode(buf));
      if (!text.trim()) return { pages: null, text: "", pageCount: null, scanned: false, reason: "This text file is empty." };
      return { pages: [text], text, pageCount: null, scanned: false, reason: "", noPages: true };
    }
    return { pages: null, text: "", pageCount: null, scanned: false, reason: "This kind of file is not supported." };
  } catch (e) {
    const msg = String(e?.message ?? e);
    const reason = /password|encrypt/i.test(msg) ? "This file is password-protected, so it can't be read." : "This file can't be read. It may be damaged.";
    return { pages: null, text: "", pageCount: null, scanned: false, reason };
  }
}
