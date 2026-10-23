// Query embeddings for search by meaning. Server-only. voyage-4 through the normal embeddings API (never the Batch API, never another model), by default 256 dimensions,
// input_type "query". `dim` is the size the vector store expects (256 for the Neon tables). The key is read here from VOYAGE_API_KEY and is never logged or returned. Same query -> no new Voyage call (cache + in-flight sharing).
import { LruCache, cacheKey } from "./semantic.mjs";

export const VOYAGE_MODEL = "voyage-4", EMBED_DIM = 256, VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
export const voyageConfigured = () => !!process.env.VOYAGE_API_KEY?.trim();

// Kept on globalThis so hot reloads in development do not empty the cache.
const g = globalThis as unknown as { __embedCache?: LruCache<number[]>; __embedInflight?: Map<string, Promise<number[]>>; __embedStats?: { calls: number; tokens: number; cacheHits: number } };
const cache = (g.__embedCache ??= new LruCache<number[]>(500));
const inflight = (g.__embedInflight ??= new Map<string, Promise<number[]>>());
export const embedStats = (g.__embedStats ??= { calls: 0, tokens: 0, cacheHits: 0 });

/** The query's embedding (`dim` numbers). Throws on any Voyage problem (the caller falls back to keyword search). */
export async function embedQuery(q: string, dim: number = EMBED_DIM): Promise<number[]> {
  const key = `${dim}|${cacheKey(q)}`, hit = cache.get(key);
  if (hit) { embedStats.cacheHits++; return hit; }
  const pending = inflight.get(key);
  if (pending) return pending;
  const p = (async () => {
    const apiKey = process.env.VOYAGE_API_KEY?.trim();
    if (!apiKey) throw new Error("no voyage key");
    const r = await fetch(VOYAGE_URL, {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ input: [q], model: VOYAGE_MODEL, input_type: "query", output_dimension: dim }),
    });
    if (!r.ok) throw new Error(`voyage ${r.status}`);
    const j = (await r.json()) as { data?: { embedding: number[] }[]; usage?: { total_tokens?: number } };
    const v = j.data?.[0]?.embedding;
    if (!v || v.length !== dim) throw new Error("voyage returned an unexpected vector");
    embedStats.calls++; embedStats.tokens += j.usage?.total_tokens ?? 0;
    cache.set(key, v);
    return v;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
