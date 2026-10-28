// Old addresses that now go somewhere else, so bookmarks and shared links keep working (docs/RESKIN-IA-PLAN.md, section 1.6). PURE data, used by next.config.mjs.
// Next.js applies these BEFORE the password check, so an old link first lands on the new address and then, if you are signed out, on the password page (with ?next= set to the new address).
// Phase 1: every removed page goes to HOME, which is the existing dashboard until Desk exists. Phase 3 changes HOME to "/" and adds the `/workspace/*` moves.
export const HOME = "/workspace";

const REMOVED = [
  // the mock Developer console, the copied docs and the mock account pages
  "/developer", "/docs", "/auth",
  // the copied marketing pages (lexbharat.ai is the marketing site)
  "/about", "/affiliates", "/alerts", "/blog", "/brand", "/claude-plugin", "/clauses", "/contact", "/customer", "/engineering", "/for-lawyers", "/in", "/legal-aid", "/legal-api", "/mcp",
  "/open-us-law", "/partners", "/playbooks", "/playground", "/slack", "/support", "/topics", "/use-case", "/white-label", "/word",
  // legal pages that were copied from a SaaS site: only Privacy, Terms and Security stay
  "/dpa", "/sla", "/refund-policy", "/accessibility",
];

/** [source, destination] pairs in Next.js redirect syntax (`:path*` also matches the bare path). */
export const REDIRECTS = [
  ["/", HOME],
  ...REMOVED.map((p) => [`${p}/:path*`, p === "/auth" ? "/access" : HOME]),
  ["/cookies", "/privacy"], ["/delete-data", "/privacy"], ["/security/vulnerability-disclosure", "/security"],
];

/** The shape next.config.mjs `redirects()` wants. Temporary (307) in Phase 1: the destinations move again in Phase 3, so nothing should be cached as permanent yet. */
export const toNextRedirects = () => REDIRECTS.map(([source, destination]) => ({ source, destination, permanent: false }));
