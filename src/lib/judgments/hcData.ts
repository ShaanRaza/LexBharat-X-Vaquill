// High Court case pages: where they are read from. Server-only. Layout (written by scripts/judgments/export-judgments-hc.sh):
//   court=<slug>/year=<YYYY>/page=<N>/data_0.json                 (JSON array, 100 cases per page, N from 1, newest first)
//   court=<slug>/year=<YYYY>/disp=<slug>/page=<N>/data_0.json     the same cases filtered by disposition chip (rows add mainPage)
//   court=<slug>/year=<YYYY>/bench=<single|division|larger>/page=<N>/data_0.json   filtered by bench class (Bombay, Gujarat, Orissa)
//   court=<slug>/year=<YYYY>/facets.json                          counts for the filters of that year
// Source, first match wins:
//   JUDGMENTS_DATA_DIR  a local folder holding that layout (development; relative paths resolve from the project root)
//   JUDGMENTS_DATA_URL  an https base URL serving that layout (production: any static host or object-storage bucket, no SDK needed)
// With neither set, High Court case lists are simply not available and the UI says so.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import type { CaseItem, Facet } from "./types";

export const HC_PAGE_SIZE = 100;

export function hcSourceKind(): "dir" | "url" | null {
  if (process.env.JUDGMENTS_DATA_DIR) return "dir";
  if (process.env.JUDGMENTS_DATA_URL) return "url";
  return null;
}

const clean = (r: Record<string, unknown>): CaseItem => { const o: Record<string, unknown> = {}; for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) o[k] = v; return o as unknown as CaseItem; };

export type HcFilter = { kind: "disp" | "bench"; key: string };
export type HcFacets = { disposition: (Facet & { slug: string })[]; bench: Facet[] };
const SLUG = /^[a-z0-9-]{1,40}$/;

async function readJson(rel: string): Promise<unknown | null> {
  try {
    if (process.env.JUDGMENTS_DATA_DIR) {
      const root = path.resolve(process.cwd(), process.env.JUDGMENTS_DATA_DIR);
      return JSON.parse(await readFile(path.join(root, rel), "utf8"));
    }
    if (process.env.JUDGMENTS_DATA_URL) {
      const r = await fetch(`${process.env.JUDGMENTS_DATA_URL.replace(/\/+$/, "")}/${rel}`, { next: { revalidate: 86400 } });
      return r.ok ? await r.json() : null;
    }
  } catch { /* missing file or unreadable source: treated as "not there" */ }
  return null;
}
const okCourtYear = (court: string, year: number) => ALL_COURTS.some((c) => c.slug === court) && Number.isInteger(year) && year >= 1900 && year <= 2026;

/** One 100-case page of a court-year (optionally of a filtered list), or null when the page does not exist or the source is not configured. Arguments are validated, never joined raw into a path. */
export async function readHcPage(court: string, year: number, page: number, filter?: HcFilter): Promise<CaseItem[] | null> {
  if (!okCourtYear(court, year) || !Number.isInteger(page) || page < 1 || page > 100000 || (filter && (!SLUG.test(filter.key) || (filter.kind !== "disp" && filter.kind !== "bench")))) return null;
  const rows = await readJson(`court=${court}/year=${year}/${filter ? `${filter.kind}=${filter.key}/` : ""}page=${page}/data_0.json`);
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]).map(clean) : null;
}

/** Opening-text previews of one Supreme Court year ({caseId: text}), or null (no source, or no previews for that year). */
export async function readScPreviews(year: number): Promise<Record<string, string> | null> {
  if (!okCourtYear("supreme-court-of-india", year)) return null;
  const m = await readJson(`court=supreme-court-of-india/year=${year}/preview.json`);
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, string>) : null;
}

/** Filter counts for one court-year, or null when the year has none (or no source). */
export async function readHcFacets(court: string, year: number): Promise<HcFacets | null> {
  if (!okCourtYear(court, year)) return null;
  const f = (await readJson(`court=${court}/year=${year}/facets.json`)) as Partial<HcFacets> | null;
  return f ? { disposition: f.disposition ?? [], bench: f.bench ?? [] } : null;
}
