// Document-side embeddings for the Vault: voyage-4, 256 dimensions, input_type "document", normal embeddings API (never the Batch API). The free Voyage account allows 3 requests a minute, so calls are
// spaced by `embedMinGapMs` (shared with nothing else in this process); when it is too soon the caller is told how long to wait instead of being made to fail. The key is read here and never logged.
import { EMBED_DIM, VOYAGE_MODEL, VOYAGE_URL } from "@/lib/acts/embed";

const g = globalThis as unknown as { __vaultVoyageLast?: number };
export class EmbedWait extends Error { constructor(public waitMs: number, public reason: "gap" | "rate" | "error") { super(`wait ${waitMs}`); } }

/** Embeds texts as documents. Throws EmbedWait (with how long to wait) when spaced out too closely or Voyage says busy. */
export async function embedDocuments(texts: string[], minGapMs: number): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY?.trim(); if (!key) throw new Error("no voyage key");
  const since = Date.now() - (g.__vaultVoyageLast ?? 0);
  if (since < minGapMs) throw new EmbedWait(minGapMs - since, "gap");
  g.__vaultVoyageLast = Date.now();
  let r: Response;
  try { r = await fetch(VOYAGE_URL, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(25000),
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: "document", output_dimension: EMBED_DIM, truncation: true }) }); }
  catch { throw new EmbedWait(15000, "error"); }
  if (r.status === 429) throw new EmbedWait(Math.max(minGapMs, 30000), "rate");
  if (!r.ok) throw new EmbedWait(20000, "error");
  const j = (await r.json()) as { data?: { index: number; embedding: number[] }[] };
  const vecs = (j.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (vecs.length !== texts.length || vecs.some((v) => v.length !== EMBED_DIM)) throw new EmbedWait(20000, "error");
  return vecs;
}
