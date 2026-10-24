// Reads the text out of an uploaded file with free libraries (unpdf for PDF, mammoth for Word, plain decoding for text). No OCR here: a PDF page with almost no text is an image-only page (a scan),
// listed in `scanPages` (1-based) for the model-based reader (process.ts) to read; pictures (jpg, png) are one scan page.
// Returns { pages: string[] | null, text, pageCount, scanned, scanPages, reason }. `pages` is per page for a PDF ('' for a scan page); Word and text files have no page numbers (pages = null). Never throws for bad files: reason says why.

const norm = (s) => String(s).replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");

export async function extractText(kind, bytes, { scannedMinCharsPerPage = 25 } = {}) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try {
    if (kind === "pdf") {
      const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const r = await pdfText(pdf, { mergePages: false });
      const pages = r.text.map(norm), scanPages = pages.flatMap((p, i) => (p.replace(/\s+/g, "").length < scannedMinCharsPerPage ? [i + 1] : []));
      // a page that is mostly a picture still has its few printed characters (a page number) dropped here: the model reads the whole page and returns everything on it
      return { pages: pages.map((p, i) => (scanPages.includes(i + 1) ? "" : p)), text: pages.join("\n\n"), pageCount: r.totalPages, scanned: scanPages.length === pages.length, scanPages, reason: "" };
    }
    if (kind === "jpg" || kind === "png") return { pages: [""], text: "", pageCount: 1, scanned: true, scanPages: [1], reason: "", noPages: false };
    if (kind === "docx") {
      const mammoth = await import("mammoth");
      const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      const text = norm(r.value);
      if (!text.trim()) return { pages: null, text: "", pageCount: null, scanned: false, scanPages: [], reason: "No text was found in this Word file." };
      return { pages: [text], text, pageCount: null, scanned: false, scanPages: [], reason: "", noPages: true };
    }
    if (kind === "txt") {
      const text = norm(new TextDecoder("utf-8").decode(buf));
      if (!text.trim()) return { pages: null, text: "", pageCount: null, scanned: false, scanPages: [], reason: "This text file is empty." };
      return { pages: [text], text, pageCount: null, scanned: false, scanPages: [], reason: "", noPages: true };
    }
    return { pages: null, text: "", pageCount: null, scanned: false, scanPages: [], reason: "This kind of file is not supported." };
  } catch (e) {
    const msg = String(e?.message ?? e);
    const reason = /password|encrypt/i.test(msg) ? "This file is password-protected, so it can't be read." : "This file can't be read. It may be damaged.";
    return { pages: null, text: "", pageCount: null, scanned: false, scanPages: [], reason };
  }
}
