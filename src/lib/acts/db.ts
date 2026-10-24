// Neon Postgres access for Act section search and Act pages. Server-only. Without DATABASE_URL every caller gets `null` and shows the honest "not available yet"
// state; the connection string is read here and nowhere else, and is never logged.
import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;
let client: Sql | null | undefined;

export const dbConfigured = () => !!process.env.DATABASE_URL?.trim();

export function getSql(): Sql | null {
  if (client !== undefined) return client;
  const url = process.env.DATABASE_URL?.trim();
  client = url ? neon(url) : null;
  return client;
}

/** Runs one parameterised query with a statement timeout; returns rows. Throws on database errors (callers turn that into a calm message). */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = [], timeoutMs = 8000): Promise<T[]> {
  const sql = getSql();
  if (!sql) throw new Error("no database");
  const res = await sql.transaction((tx) => [tx.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`), tx.query(text, params)]);
  return res[1] as T[];
}

