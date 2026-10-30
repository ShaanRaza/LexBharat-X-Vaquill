// GET /api/vault/selftest[?voyage=1&meaning=1&gemini=1&openrouter=1] -> runs each stage of document processing on tiny generated files and reports pass/fail with timings, so a deployment can be checked in one click (open it in the browser, signed in).
// Stages: settings present, storage write/read/delete, database read, reading a PDF and a Word file with the same code the Vault uses, and (only with ?voyage=1, one request to Voyage) a direct Voyage request, and (only with ?gemini=1, one small request to the Review model) a direct Gemini request, and (only with ?openrouter=1) a direct OpenRouter request.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph } from "docx";
import { bidOf, json, vaultReady } from "@/lib/vault/http";
import { extractText, readPdfPages } from "@/lib/vault/extract.mjs";
import config from "@/config/ai-models.json";
import { creditStatus } from "@/lib/ai/guard.mjs";
import { chatProbe, geminiProbe } from "@/lib/ai/probe";
import { voyageProbe } from "@/lib/vault/embedDocs";
import { getFileStore } from "@/lib/vault/storage";
import { listDocs } from "@/lib/vault/store";
import { probeMeaning } from "@/lib/legal-data";
import { meaningSnapshot } from "@/lib/acts/meaningLog";
import { CAUSE_LABEL } from "@/lib/acts/meaning.mjs";

export const maxDuration = 60;
type Row = { stage: string; ok: boolean; ms: number; detail: string };
export async function GET(req: Request) {
  const bid = bidOf(req); if (!bid) return json({ error: "Not found." }, 404);
  const rows: Row[] = [], run = async (stage: string, f: () => Promise<string>) => { const t = Date.now(); try { const detail = await f(); rows.push({ stage, ok: true, ms: Date.now() - t, detail }); } catch (e) { rows.push({ stage, ok: false, ms: Date.now() - t, detail: String((e as Error)?.message ?? e).slice(0, 200) }); } };
  const env = (k: string) => !!process.env[k]?.trim();
  await run("settings", async () => { const need = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "VOYAGE_API_KEY"], miss = need.filter((k) => !env(k)); if (miss.length) throw new Error(`missing: ${miss.join(", ")}`); return `node ${process.version}, region ${process.env.VERCEL_REGION ?? "local"}, scan model key ${env("GEMINI_API_KEY") ? "set" : "NOT set"}`; });
  // always shown when a spend guard is configured: is the paid route on, or paused because the credit is low?
  if (config.spendGuard?.provider) await run("Spend guard (OpenRouter credit)", async () => { const c = await creditStatus({ config, env: process.env as Record<string, string | undefined>, force: true }); if (!c.checked) throw new Error(c.reason); return `${c.tripped ? "PAUSED, everything uses free Gemini" : "paid route on"}: $${c.remaining?.toFixed(2) ?? "no limit"} left of $${c.limit ?? "no limit"}, pauses below $${c.minRemaining?.toFixed(2)}`; });
  if (vaultReady()) {
    await run("storage", async () => {
      const st = getFileStore(), key = `${bid}/selftest/${crypto.randomUUID()}.txt`, { sb } = await import("@/lib/vault/supabase"), { default: lim } = await import("@/config/vault-limits.json");
      const up = await sb().storage.from(process.env.VAULT_BUCKET?.trim() || lim.bucket).upload(key, new Blob(["selftest"], { type: "text/plain" }), { upsert: false }); if (up.error) throw new Error(`write: ${up.error.message}`);
      try { const size = await st.size(key); if (size !== 8) throw new Error(`size lookup gave ${size}`); const b = await st.get(key); if (!b || b.length !== 8) throw new Error("read back failed"); } finally { await st.remove([key]).catch(() => null); }
      return "write, size, read, delete ok";
    });
    await run("database", async () => `${(await listDocs(bid)).length} documents listed`);
  }
  await run("read a PDF", async () => {
    const d = await PDFDocument.create(), f = await d.embedFont(StandardFonts.TimesRoman);
    for (let i = 1; i <= 3; i++) d.addPage().drawText(`Section ${i}. The petitioner submitted that the notice was served on the respondent on time.`, { x: 40, y: 700, size: 11, font: f });
    const r = await readPdfPages(await d.save(), 1, { maxPages: 2 });
    if (r.total !== 3 || r.pages.length !== 2 || !/petitioner/.test(r.pages[1])) throw new Error(r.reason || `got ${r.pages.length} of ${r.total} pages`);
    return "3 pages, read 2 in a slice";
  });
  await run("read a Word file", async () => {
    const r = await extractText("docx", await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("This agreement is made between the parties.")] }] })));
    if (!r.pages || !/agreement/.test(r.text)) throw new Error(r.reason || "no text");
    return "text found";
  });
  // always shown: how often search by meaning gave way to exact words on THIS server instance since it started (the day totals over all instances are in /admin)
  await run("Search by meaning: fallbacks since this server started", async () => {
    const m = meaningSnapshot(), searches = Object.values(m.searches).reduce((a, b) => a + b, 0), fell = Object.values(m.fellBack).reduce((a, b) => a + b, 0), partial = Object.values(m.partial).reduce((a, b) => a + b, 0);
    const why = Object.entries(m.fellBack).map(([k, n]) => `${k.split(":")[0]}: ${CAUSE_LABEL[k.split(":")[1] as keyof typeof CAUSE_LABEL] ?? k.split(":")[1]} ${n}`).join("; ");
    if (fell || partial) throw new Error(`${fell} of ${searches} meaning searches fell back to exact words${why ? ` (${why})` : ""}${partial ? `; ${partial} had a vector database missing` : ""}; last: ${m.last ? `${m.last.surface} ${m.last.cause} at ${m.last.at}` : "n/a"}`);
    return `${searches} meaning searches since ${m.sinceIso}, none fell back${searches === 0 ? " (nothing has been searched on this instance yet)" : ""}`;
  });
  // one Voyage request: the query vector has the size every vector store expects, and each store answers with hits (live; the cache is bypassed with a one-off query)
  if (new URL(req.url).searchParams.get("meaning") === "1") await run("Search by meaning, live (1 Voyage request)", async () => {
    return probeMeaning();
  });
  if (new URL(req.url).searchParams.get("voyage") === "1") await run("Voyage, direct (no gate)", async () => { const v = await voyageProbe(); if (!v.ok) throw new Error(`${v.status ?? "no answer"}: ${v.detail}`); return `ok, ${v.status} in ${v.ms} ms`; });
  if (new URL(req.url).searchParams.get("gemini") === "1") await run("Gemini, direct (no retries)", async () => { const v = await geminiProbe(); if (!v.ok) throw new Error(`${v.status ?? "no answer"}: ${v.detail}`); return `ok, ${v.status} in ${v.ms} ms (${v.detail})`; });
  if (new URL(req.url).searchParams.get("openrouter") === "1") await run("OpenRouter, direct", async () => { const v = await chatProbe("openrouter"); if (!v.ok) throw new Error(`${v.status ?? "no answer"}: ${v.detail}`); return `ok, ${v.status} in ${v.ms} ms (${v.detail})`; });
  return json({ ok: rows.every((r) => r.ok), rows });
}
