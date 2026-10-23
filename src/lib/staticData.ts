// Reads the large static data files (public/data, copied by scripts/copy-static-data.mjs) from the site's own CDN at run time, so they are NOT part of any server function.
// The address is FIXED, never taken from the incoming request (a Host header can be forged):
//   production  https://$VERCEL_PROJECT_PRODUCTION_URL   (set by Vercel)
//   preview     https://$VERCEL_URL                       (set by Vercel)
//   development http://localhost:3100, or STATIC_DATA_BASE_URL when the dev server runs on another port
// Parsed files are kept in memory for the life of the server instance. A failed fetch is never cached: the next request tries again. Server-only.

const cache = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 24;

export function staticBaseUrl(): string {
  const override = process.env.STATIC_DATA_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, "");
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3100";
}

export function staticJson<T>(rel: string): Promise<T> {
  const hit = cache.get(rel);
  if (hit) return hit as Promise<T>;
  const p = fetch(`${staticBaseUrl()}/data/${rel}`, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error(`static data ${rel}: ${r.status}`); return r.json(); });
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(rel, p);
  p.catch(() => { if (cache.get(rel) === p) cache.delete(rel); }); // do not keep a failure
  return p as Promise<T>;
}
