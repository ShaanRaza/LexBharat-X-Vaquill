// ONE interface for "which sections are closest in meaning to this query vector", per corpus (central Acts, state Acts). Server-only. LOGIC ONLY.
// Today both corpora are halfvec(256) tables in a Neon pgvector database (VECTOR_DATABASE_URL). Each corpus can be switched to a Qdrant collection on the search server by
// environment variables alone (docs/PAID-SWITCHOVER.md); nothing else in the app knows which backend answers.
//   SEMANTIC_BACKEND_CENTRAL / SEMANTIC_BACKEND_STATE   "neon" (default) | "qdrant"
//   neon:   VECTOR_DATABASE_URL      tables central_emb_256 / state_emb_256 (scripts/acts/load-qdrant-vectors.mjs), 256 dimensions;
//           VECTOR_DATABASE_URL_CENTRAL / _STATE (optional) give one corpus its own Neon project (each free project holds 1 GB)
//   qdrant: QDRANT_URL, QDRANT_API_KEY (optional), QDRANT_COLLECTION_CENTRAL / _STATE (required),
//           QDRANT_VECTOR_NAME (default "dense"), QDRANT_FILTER_CENTRAL / _STATE (optional JSON Qdrant filter, e.g. {"must":[{"key":"category","match":{"value":"state"}}]}),
//           SEMANTIC_DIM_CENTRAL / _STATE (query embedding size for that collection; default 1024 = what the open-india-law vectors are)
// Connection strings and keys are read here and never logged or returned.
import { neon } from "@neondatabase/serverless";
import { parseChunkId } from "./reassemble.mjs";
import { vectorLiteral } from "./semantic.mjs";

export type Corpus = "central" | "state" | "supplement" | "regulatory" | "sc";
export type VectorHit = { actId: string; sectionKey: string; distance: number };
export interface VectorStore {
  readonly corpus: Corpus;
  readonly backend: "neon" | "qdrant";
  /** Size of the query vector this store expects (voyage-4 output_dimension). */
  readonly dim: number;
  /** Nearest chunks, best first (cosine distance, 0 = identical). */
  nearest(vector: number[], limit: number): Promise<VectorHit[]>;
}

// "supplement" = the sections filled in by hand (content/supplement, `npm run load:supplement`): a tiny extra table, supplement_emb_256, searched alongside the two corpora.
export const CORPORA: Corpus[] = ["central", "state", "supplement"];   // searched together for Acts; "regulatory" (regulator instruments, W10) has its own scope and its own table regulatory_emb_256 / project VECTOR_DATABASE_URL_REGULATORY
const upper = (c: Corpus) => c.toUpperCase();
const env = (name: string) => process.env[name]?.trim() || "";

// ---- Neon pgvector
const neonClients = new Map<string, ReturnType<typeof neon>>();
/** The connection string for a corpus: its own VECTOR_DATABASE_URL_<CORPUS> if set, else the shared VECTOR_DATABASE_URL. */
const neonUrl = (corpus: Corpus) => env(`VECTOR_DATABASE_URL_${upper(corpus)}`) || env("VECTOR_DATABASE_URL");
export const NEON_DIM = 256;

function neonStore(corpus: Corpus): VectorStore | null {
  const url = neonUrl(corpus);
  if (!url) return null;
  const table = `${corpus}_emb_${NEON_DIM}`; // fixed names, never from input
  return {
    corpus, backend: "neon", dim: NEON_DIM,
    async nearest(vector, limit) {
      let sql = neonClients.get(url);
      if (!sql) neonClients.set(url, (sql = neon(url)));
      const lit = vectorLiteral(vector), n = Math.floor(limit);
      const res = await sql.transaction((tx) => [
        tx.query("SET LOCAL statement_timeout = 20000"),
        tx.query(`SET LOCAL hnsw.ef_search = ${Math.min(1000, Math.max(100, n))}`),
        tx.query(`SELECT act_id AS "actId", section_key AS "sectionKey", embedding <=> $1::halfvec AS distance FROM ${table} ORDER BY embedding <=> $1::halfvec LIMIT ${n}`, [lit]),
      ]);
      return res[2] as VectorHit[];
    },
  };
}

// ---- Qdrant (search server)
function qdrantStore(corpus: Corpus): VectorStore | null {
  const url = env("QDRANT_URL"), collection = env(`QDRANT_COLLECTION_${upper(corpus)}`);
  if (!url || !collection) return null;
  const dim = Number(env(`SEMANTIC_DIM_${upper(corpus)}`) || 1024);
  let filter: unknown;
  const rawFilter = env(`QDRANT_FILTER_${upper(corpus)}`);
  if (rawFilter) { try { filter = JSON.parse(rawFilter); } catch { return null; } }
  const using = env("QDRANT_VECTOR_NAME") || "dense", key = env("QDRANT_API_KEY");
  return {
    corpus, backend: "qdrant", dim,
    async nearest(vector, limit) {
      const r = await fetch(`${url.replace(/\/$/, "")}/collections/${encodeURIComponent(collection)}/points/query`, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", ...(key ? { "api-key": key } : {}) },
        body: JSON.stringify({ query: vector, using, limit, with_payload: ["chunk_id", "act_id"], ...(filter ? { filter } : {}) }),
      });
      if (!r.ok) throw new Error(`qdrant ${r.status}`);
      const j = (await r.json()) as { result?: { points?: { score: number; payload?: { chunk_id?: string; act_id?: string } }[] } };
      const out: VectorHit[] = [];
      for (const p of j.result?.points ?? []) {
        const actId = p.payload?.act_id, cid = p.payload?.chunk_id, id = actId && cid ? parseChunkId(cid, actId) : null;
        if (actId && id) out.push({ actId, sectionKey: id.key, distance: 1 - p.score }); // cosine similarity -> distance
      }
      return out;
    },
  };
}

/** The stores that are set up, one per corpus. Empty when nothing is configured (the caller then uses keyword search). */
export function vectorStores(): VectorStore[] {
  const out: VectorStore[] = [];
  for (const c of CORPORA) {
    const backend = (env(`SEMANTIC_BACKEND_${upper(c)}`) || "neon").toLowerCase();
    const s = backend === "qdrant" ? qdrantStore(c) : backend === "neon" ? neonStore(c) : null;
    if (s) out.push(s);
  }
  return out;
}
export const vectorConfigured = () => vectorStores().length > 0;
/** The regulator-instrument vector store (VECTOR_DATABASE_URL_REGULATORY, or the shared VECTOR_DATABASE_URL), or null when it is not set up. */
export const regulatoryStore = (): VectorStore | null => neonStore("regulatory");
/** Supreme Court judgment chunks (sc_emb_256 in the project named by VECTOR_DATABASE_URL_SC); null unless that variable is set (never falls back to the Acts project). */
export const scVectorStore = (): VectorStore | null => (env("VECTOR_DATABASE_URL_SC") ? neonStore("sc") : null);
