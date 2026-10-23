// Neon Postgres (pgvector) access for search by meaning. Server-only. This is the only reader of VECTOR_DATABASE_URL; the string is never logged or returned.
// Without it every caller falls back to keyword search.
import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;
let client: Sql | null | undefined;

/** Central Act chunk vectors: halfvec(256), HNSW cosine index. Columns: chunk_id, act_id, section_key, embedding. Built by scripts/acts/load-central-vectors.mjs. */
export const VECTOR_TABLE = "central_emb_256";

export const vectorConfigured = () => !!process.env.VECTOR_DATABASE_URL?.trim();

function getVectorSql(): Sql | null {
  if (client !== undefined) return client;
  const url = process.env.VECTOR_DATABASE_URL?.trim();
  client = url ? neon(url) : null;
  return client;
}

/** Nearest chunks to a query vector (cosine), best first. */
export async function nearestChunks(vectorLiteral: string, limit: number, timeoutMs = 15000): Promise<{ actId: string; sectionKey: string; distance: number }[]> {
  const sql = getVectorSql();
  if (!sql) throw new Error("no vector database");
  const res = await sql.transaction((tx) => [
    tx.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`),
    tx.query("SET LOCAL hnsw.ef_search = 100"),
    tx.query(`SELECT act_id AS "actId", section_key AS "sectionKey", embedding <=> $1::halfvec AS distance FROM ${VECTOR_TABLE} ORDER BY embedding <=> $1::halfvec LIMIT ${Math.floor(limit)}`, [vectorLiteral]),
  ]);
  return res[2] as { actId: string; sectionKey: string; distance: number }[];
}
