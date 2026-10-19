/**
 * THE release toggle. One switch controls every dev/demo annotation in the app.
 *
 *   NEXT_PUBLIC_RELEASE=1  → release mode: no banner, no MOCK badges, no "data source" strips,
 *                            no "(local mock)" in page titles, no dev-only explanatory notes.
 *   NEXT_PUBLIC_RELEASE=0  → demo mode (default in `npm run dev`): all annotations visible.
 *
 * Where the value comes from (highest priority first):
 *   1. a shell variable:          NEXT_PUBLIC_RELEASE=1 npm run build
 *   2. .env.local                  (your own overrides, not committed)
 *   3. .env.production / .env.development  (committed defaults: production = 1, development = 0)
 *
 * It is inlined at build time, so changing it requires a rebuild (`npm run build`) or a dev-server restart.
 */
export const RELEASE = process.env.NEXT_PUBLIC_RELEASE === "1";

/** Suffix used in browser-tab titles. */
export const BRAND_SUFFIX = RELEASE ? "LexBharat" : "LexBharat (local mock)";
export const DOCS_SUFFIX = RELEASE ? "LexBharat docs" : "LexBharat docs (local mock)";

/** Returns the text in demo mode and an empty string in release mode. Use for dev-only sentences inside copy. */
export const dev = (text: string): string => (RELEASE ? "" : text);
