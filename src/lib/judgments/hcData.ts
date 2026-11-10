// High Court case pages: where they are read from. Server-only. Layout (written by scripts/judgments/export-judgments-hc.sh):
//   court=<slug>/year=<YYYY>/page=<N>/data_0.json                 (JSON array, 100 cases per page, N from 1, newest first)
//   court=<slug>/year=<YYYY>/disp=<slug>/page=<N>/data_0.json     the same cases filtered by disposition chip (rows add mainPage)
//   court=<slug>/year=<YYYY>/facets.json                          counts for the filters of that year
// Source, first match wins:
//   JUDGMENTS_DATA_DIR  a local folder holding that layout (development; relative paths resolve from the project root)
//   JUDGMENTS_DATA_URL  an https base URL serving that layout (production: any static host or object-storage bucket, no SDK needed)
// With neither set, High Court case lists are simply not available and the UI says so.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ALL_COURTS } from "@/data/workspaceBrowse";
import { parseTitleCourts, pickHcFields, titlesOn } from "./hcRecord.mjs";
import type { CaseItem, Facet } from "./types";

export const HC_PAGE_SIZE = 100;

export function hcSourceKind(): "dir" | "url" | null {
  if (process.env.JUDGMENTS_DATA_DIR) return "dir";
  if (process.env.JUDGMENTS_DATA_URL) return "url";
  return null;
}

// Only the allowed High Court fields reach the site, even from an older export that still holds petitioner, respondent or judges. The case title
// (`title`) is kept only for courts named in HC_TITLE_COURTS (default empty: only the case number shows). This is the one place the
// switch is applied: lists, search results, the case page and the API all read pages through here.
const clean = (r: Record<string, unknown>, court: string): CaseItem => pickHcFields(r, { titles: titlesOn(court, process.env.HC_TITLE_COURTS) }) as unknown as CaseItem;
const badSwitch = parseTitleCourts(process.env.HC_TITLE_COURTS).bad;
if (badSwitch.length) console.error(`HC_TITLE_COURTS names no High Court (${badSwitch.join(", ")}): High Court titles stay off. Use court slugs such as bombay-high-court, "*" or "none".`);

export type HcFilter = { kind: "disp"; key: string };
export type HcFacets = { disposition: (Facet & { slug: string })[] };
const SLUG = /^[a-z0-9-]{1,40}$/;

/** Reads one JSON file of the exported data (local folder or hosted base URL); null when missing or when no source is configured. */
export async function readDataJson(rel: string, opts: { noCache?: boolean } = {}): Promise<unknown | null> {
  try {
    if (process.env.JUDGMENTS_DATA_DIR) {
      // path.resolve(<one runtime value>) resolves against the working directory at run time. Writing process.cwd() here made the build tracer treat the WHOLE project
      // folder (.next/cache, .git, node_modules ...) as a dependency of every judgments function (about 745 MB each).
      const root = path.resolve(process.env.JUDGMENTS_DATA_DIR);
      return JSON.parse(await readFile(path.join(root, rel), "utf8"));
    }
    if (process.env.JUDGMENTS_DATA_URL) {
      const r = await fetch(`${process.env.JUDGMENTS_DATA_URL.replace(/\/+$/, "")}/${rel}`, opts.noCache ? { cache: "no-store" } : { next: { revalidate: 86400 } });
      return r.ok ? await r.json() : null;
    }
  } catch { /* missing file or unreadable source: treated as "not there" */ }
  return null;
}
const okCourtYear = (court: string, year: number) => ALL_COURTS.some((c) => c.slug === court) && Number.isInteger(year) && year >= 1900 && year <= 2026;

/** One 100-case page of a court-year (optionally of a filtered list), or null when the page does not exist or the source is not configured. Arguments are validated, never joined raw into a path. */
export async function readHcPage(court: string, year: number, page: number, filter?: HcFilter): Promise<CaseItem[] | null> {
  if (!okCourtYear(court, year) || !Number.isInteger(page) || page < 1 || page > 100000 || (filter && (!SLUG.test(filter.key) || filter.kind !== "disp"))) return null;
  const rows = await readDataJson(`court=${court}/year=${year}/${filter ? `${filter.kind}=${filter.key}/` : ""}page=${page}/data_0.json`);
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]).map((r) => clean(r, court)) : null;
}

/** Opening-text previews of one Supreme Court year ({caseId: text}), or null (no source, or no previews for that year). */
export async function readScPreviews(year: number): Promise<Record<string, string> | null> {
  if (!okCourtYear("supreme-court-of-india", year)) return null;
  const m = await readDataJson(`court=supreme-court-of-india/year=${year}/preview.json`);
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, string>) : null;
}

/** Filter counts for one court-year, or null when the year has none (or no source). */
export async function readHcFacets(court: string, year: number): Promise<HcFacets | null> {
  if (!okCourtYear(court, year)) return null;
  const f = (await readDataJson(`court=${court}/year=${year}/facets.json`)) as Partial<HcFacets> | null;
  return f ? { disposition: f.disposition ?? [] } : null;
}
