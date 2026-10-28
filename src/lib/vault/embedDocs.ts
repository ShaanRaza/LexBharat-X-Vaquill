// Document-side embeddings for the Vault: voyage-4, 256 dimensions, input_type "document", normal embeddings API (never the Batch API). The free Voyage account allows 3 requests a minute, so calls are
// spaced by `embedMinGapMs` (shared with nothing else in this process); when it is too soon the caller is told how long to wait instead of being made to fail. The key is read here and never logged.
import { EMBED_DIM, VOYAGE_MODEL, VOYAGE_URL } from "@/lib/acts/embed";
import { rateCheck } from "@/lib/limits/counters";

// The free Voyage account allows 3 requests a minute for the WHOLE app. On Vercel every poll can land on a different server instance, so a per-process timer cannot hold that limit: the pages
// polled, every instance thought it was allowed, and Voyage answered "busy" forever. The limit is therefore counted in Supabase (all instances share it): at most 2 document requests a minute,
// leaving one for search by meaning. Over the limit, the caller is told how many seconds to wait; nothing sleeps inside a request.
export const VOYAGE_DOC_REQUESTS_PER_MINUTE = 2;

const g = globalThis as unknown as { __vaultVoyageLast?: number };
export class EmbedWait extends Error { constructor(public waitMs: number, public reason: "gap" | "rate" | "error", public why = "") { super(`wait ${waitMs}${why ? ` (${why})` : ""}`); } }

/** Embeds texts as documents. Throws EmbedWait (with how long to wait) when spaced out too closely or Voyage says busy. */
export async function embedDocuments(texts: string[], minGapMs: number): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY?.trim(); if (!key) throw new Error("no voyage key");
  const gate = await rateCheck("voyage-docs", "all", VOYAGE_DOC_REQUESTS_PER_MINUTE, 60);
  if (!gate.ok) throw new EmbedWait(Math.max(2000, gate.retryAfterSec * 1000), "gap");
  const since = Date.now() - (g.__vaultVoyageLast ?? 0);   // (also keeps the old per-process gap, which is what holds the limit when Supabase is not configured)
  if (since < minGapMs / 3) throw new EmbedWait(minGapMs / 3 - since, "gap");
  g.__vaultVoyageLast = Date.now();
  let r: Response;
  try { r = await fetch(VOYAGE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: "document", output_dimension: EMBED_DIM, truncation: true }) }); }
  catch { throw new EmbedWait(15000, "error"); }
  if (r.status === 429) throw new EmbedWait(Math.max(minGapMs, 30000), "rate");
  if (!r.ok) throw new EmbedWait(20000, "error", `Voyage answered ${r.status}: ${(await r.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 160)}`);   // (Voyage's error text never contains the key)
  const j = (await r.json()) as { data?: { index: number; embedding: number[] }[] };
  const vecs = (j.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vecs.length !== texts.length || vecs.some((v) => v.length !== EMBED_DIM)) throw new EmbedWait(20000, "error", `Voyage sent ${vecs.length} vectors for ${texts.length} texts, ${vecs[0]?.length ?? 0} wide`);
  return vecs;
}
