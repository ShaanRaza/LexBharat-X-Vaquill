// Old addresses that now go somewhere else, so bookmarks and shared links keep working (docs/RESKIN-IA-PLAN.md, section 1.6). PURE data, used by next.config.mjs. All are PERMANENT (308).
// Next.js applies these BEFORE the password check, so an old link first lands on the new address and then, if you are signed out, on the password page (with ?next= set to the new address).
// Entries with a `has` rule (a query value that must be present) come first; the first matching entry wins.
export const HOME = "/";

const REMOVED = [
  // the mock Developer console, the copied docs and the mock account pages
  "/developer", "/docs",
  // the copied marketing pages (lexbharat.ai is the marketing site)
  "/about", "/affiliates", "/alerts", "/blog", "/brand", "/claude-plugin", "/clauses", "/contact", "/customer", "/engineering", "/for-lawyers", "/in", "/legal-aid", "/legal-api", "/mcp",
  "/open-us-law", "/partners", "/playbooks", "/playground", "/slack", "/support", "/topics", "/use-case", "/white-label", "/word",
  // legal pages that were copied from a SaaS site: only Privacy, Terms and Security stay
  "/dpa", "/sla", "/refund-policy", "/accessibility",
];

/** { source, destination, has? } in Next.js redirect syntax (`:path*` also matches the bare path). */
export const REDIRECTS = [
  // an Act with a section in the query -> the section in the path; an old "Acts" tab -> Search
  { source: "/workspace/browse/acts/:act", has: [{ type: "query", key: "section", value: "(?<section>.+)" }], destination: "/law/:act/:section" },
  { source: "/workspace/browse", has: [{ type: "query", key: "tab", value: "acts" }], destination: "/search" },
  { source: "/workspace/browse/acts/:act", destination: "/law/:act" },
  { source: "/workspace/browse/judgments/:court/:year/:case", destination: "/judgments/:court/:year/:case" },
  { source: "/workspace/browse/judgments/:court", destination: "/library/judgments/:court" },
  { source: "/workspace/browse", destination: "/library" },
  { source: "/workspace/search", destination: "/search" },
  { source: "/workspace/chat/:path*", destination: "/ask/:path*" },
  { source: "/workspace/drafting/:path*", destination: "/work/drafts/:path*" },
  { source: "/workspace/review/:path*", destination: "/work/reviews/:path*" },
  { source: "/workspace/vault/:path*", destination: "/work/vault/:path*" },
  { source: "/workspace", destination: "/" },
  // the spec's first name for the Vault tab
  { source: "/work/documents/:path*", destination: "/work/vault/:path*" },
  { source: "/admin/insights", destination: "/admin" },
  // removed pages
  { source: "/auth/:path*", destination: "/access" },
  ...REMOVED.map((p) => ({ source: `${p}/:path*`, destination: HOME })),
  { source: "/cookies", destination: "/privacy" }, { source: "/delete-data", destination: "/privacy" }, { source: "/security/vulnerability-disclosure", destination: "/security" },
];

/** The shape next.config.mjs `redirects()` wants: all permanent. */
export const toNextRedirects = () => REDIRECTS.map((r) => ({ ...r, permanent: true }));
