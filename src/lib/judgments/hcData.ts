// High Court case pages: where they are read from. Server-only. Layout (written by scripts/judgments/export-judgments-hc.sh):
//   court=<slug>/year=<YYYY>/page=<N>/data_0.json   (JSON array, 100 cases per page, N from 1)
// Source, first match wins:
//   JUDGMENTS_DATA_DIR  a local folder holding that layout (development; relative paths resolve from the project root)
//   JUDGMENTS_DATA_URL  an https base URL serving that layout (production: any static host or object-storage bucket, no SDK needed)
// With neither set, High Court case lists are simply not available and the UI says so.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import type { CaseItem } from "./types";

export const HC_PAGE_SIZE = 100;

export function hcSourceKind(): "dir" | "url" | null {
  if (process.env.JUDGMENTS_DATA_DIR) return "dir";
  if (process.env.JUDGMENTS_DATA_URL) return "url";
  return null;
}

const clean = (r: Record<string, unknown>): CaseItem => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[k] = v; return o as unknown as CaseItem; };

/** One 100-case page of a court-year, or null when the page does not exist or the source is not configured. Arguments are validated, never joined raw into a path. */
export async function readHcPage(court: string, year: number, page: number): Promise<CaseItem[] | null> {
  if (!ALL_COURTS.some((c) => c.slug === court) || !Number.isInteger(year) || year < 1900 || year > 2026 || !Number.isInteger(page) || page < 1 || page > 100000) return null;
  const rel = `court=${court}/year=${year}/page=${page}/data_0.json`;
  try {
    if (process.env.JUDGMENTS_DATA_DIR) {
      const root = path.resolve(process.cwd(), process.env.JUDGMENTS_DATA_DIR);
      return (JSON.parse(await readFile(path.join(root, rel), "utf8")) as Record<string, unknown>[]).map(clean);
    }
    if (process.env.JUDGMENTS_DATA_URL) {
      const r = await fetch(`${process.env.JUDGMENTS_DATA_URL.replace(/\/+$/, "")}/${rel}`, { next: { revalidate: 86400 } });
      return r.ok ? ((await r.json()) as Record<string, unknown>[]).map(clean) : null;
    }
  } catch { /* missing file or unreadable source: treated as "no such page" */ }
  return null;
}
