// Database for regulator instrument text (reg_acts / reg_sections, scripts/w10/reg-schema.sql). Server-only. REG_DATABASE_URL (its own free Neon project) when set,
// otherwise DATABASE_URL (the main database, used for small tests). The connection string is read here and nowhere else, and is never logged.
import { neon } from "@neondatabase/serverless";

type Sql = ReturnType<typeof neon>;
let client: Sql | null | undefined;
const url = () => process.env.REG_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || "";

export const regConfigured = () => !!url();

/** One parameterised query with a statement timeout; rows. Throws on database errors (callers turn that into a calm message). */
export async function regQuery<T = Record<string, unknown>>(text: string, params: unknown[] = [], timeoutMs = 8000): Promise<T[]> {
  if (client === undefined) client = url() ? neon(url()) : null;
  if (!client) throw new Error("no database");
  const res = await client.transaction((tx) => [tx.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`), tx.query(text, params)]);
  return res[1] as T[];
}
