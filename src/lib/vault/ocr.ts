// Reads image-only pages with the "ocr" model task (src/config/ai-models.json: Gemini document reading now; Claude later by config only). Server-only.
import { PDFDocument } from "pdf-lib";
import { AiError, completeAi } from "@/lib/ai";
import { UNREADABLE_PAGE, parseScanOutput, scanPrompt } from "./scan.mjs";

const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const MIME = { jpg: "image/jpeg", png: "image/png" } as const;

/** A PDF made only of the wanted pages (1-based, in the order given), for one request to the reading model. */
export async function pagesAsPdf(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true }), out = await PDFDocument.create();
  for (const p of await out.copyPages(src, pages.map((p) => p - 1))) out.addPage(p);
  return out.save();
}

export type ReadResult = { ok: true; pages: Map<number, string>; model: string | null } | { ok: false; busy: boolean; message: string };
/** Reads one group of pages. `pages` are the document's page numbers; the result maps each to its text (a page the model skipped gets a short "could not be read" note, so it is not asked for again). */
export async function readScanPages(kind: string, bytes: Uint8Array, pages: number[]): Promise<ReadResult> {
  try {
    const file = kind === "jpg" || kind === "png" ? { mime: MIME[kind], data: b64(bytes) } : { mime: "application/pdf", data: b64(await pagesAsPdf(bytes, pages)) };
    const r = await completeAi("ocr", { messages: [{ role: "user", content: scanPrompt(pages.length), files: [file] }] });
    const parsed = parseScanOutput(r.text, pages.length), out = new Map<number, string>();
    pages.forEach((p, i) => out.set(p, parsed[i] ?? UNREADABLE_PAGE));
    return { ok: true, pages: out, model: r.model };
  } catch (e) {
    if (e instanceof AiError) {
      if (["rate_limit", "unavailable", "timeout"].includes(e.kind)) return { ok: false, busy: true, message: "The reading model is busy." };
      if (e.kind === "blocked") return { ok: true, pages: new Map(pages.map((p) => [p, UNREADABLE_PAGE])), model: null };
      if (e.kind === "not_configured" || e.kind === "auth") return { ok: false, busy: false, message: "Reading scanned pages is not set up on this server (no model key)." };
      return { ok: false, busy: false, message: "The scanned pages could not be read." };
    }
    return { ok: false, busy: false, message: "The scanned pages could not be read." };
  }
}
