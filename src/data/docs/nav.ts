// STATIC DATA: documentation sidebar. Section and page titles follow the public docs navigation.
// Every page in the sidebar has recreated content in pages.ts (original wording; observed structure).
import { endpoints } from "@/data/endpoints";

export type NavPage = { slug: string; title: string };
export type DocsIcon = "database" | "lightbulb" | "rocket" | "server" | "book-open" | "bell" | "code" | "sparkles" | "flask";
export type NavSection = { title: string; icon?: DocsIcon; pages: NavPage[] };

const p = (slug: string, title: string): NavPage => ({ slug, title });

/** URL slug for an endpoint reference page, e.g. api-reference/section-lookup/get-section-act-id */
export const endpointSlug = (e: { group: string; method: string; path: string }) =>
  `api-reference/${e.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${e.method.toLowerCase()}-${e.path.replace(/^\/(api\/v1\/)?(us\/)?/, "").replace(/[{}]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase()}`;
export const INDIA_REF = "api-reference/india-pricing/get-india-api-credit-pricing";

// The "Data API Guide" sidebar. Group order, group icons, item labels and item order follow the public docs sidebar (checked against the
// public API Coverage page); only the product name differs. The reference lists ten recipes, the first five of which are the ones in the
// brief; all ten are kept so nothing the reference shows is dropped.
export const guideNav: NavSection[] = [
  { title: "Data coverage", icon: "database", pages: [p("api-guide/coverage", "API Coverage"), p("api-guide/coverage/federal", "Federal coverage"), p("api-guide/coverage/states", "State and territory coverage"), p("api-guide/coverage/agency-guidance", "Agency guidance sources"), p("api-guide/coverage/india", "India legislation coverage"), p("api-guide/session-laws", "State Session Laws"), p("api-guide/roadmap", "Roadmap"), p("api-guide/changelog", "Changelog")] },
  { title: "Use cases", icon: "lightbulb", pages: [p("api-guide/use-cases", "Use Cases")] },
  { title: "Get started", icon: "rocket", pages: [p("api-guide/overview", "API Overview"), p("api-guide/quickstart", "Quickstart"), p("api-guide/authentication", "Authentication"), p("api-guide/data-privacy", "Data & Privacy")] },
  { title: "Bulk, SQL & rights", icon: "server", pages: [p("api-guide/bulk-and-sql", "Bulk and SQL access"), p("api-guide/rights-and-licensing", "Rights and licensing")] },
  { title: "Core concepts", icon: "book-open", pages: [p("api-guide/concepts/search", "How Search Works"), p("api-guide/concepts/corpus-types", "Corpus types"), p("api-guide/concepts/jurisdictions", "Jurisdictions & State Codes"), p("api-guide/concepts/citation-formats", "Citation Formats"), p("api-guide/concepts/citation-quality", "Citation resolution quality"), p("api-guide/concepts/section-ids", "Section Identifiers"), p("api-guide/concepts/section-intelligence", "Section Intelligence"), p("api-guide/point-in-time", "Point-in-time law"), p("api-guide/concepts/status-and-currency", "Status & Currency"), p("api-guide/concepts/amendment-history", "Amendment History"), p("api-guide/concepts/response-fields", "Response Fields"), p("api-guide/concepts/formats", "Response Formats")] },
  { title: "Law change alerts", icon: "bell", pages: [p("api-guide/alerts", "Law Change Alerts")] },
  { title: "Working with the API", icon: "code", pages: [p("api-guide/pagination", "Pagination"), p("api-guide/errors", "Errors"), p("api-guide/best-practices", "Best Practices"), p("api-guide/faq", "FAQ")] },
  { title: "Grounding AI", icon: "sparkles", pages: [p("api-guide/grounding-llms", "Grounding LLMs with LexBharat AI")] },
  { title: "Recipes", icon: "flask", pages: [p("api-guide/recipes/rag-grounding", "Ground an LLM answer in statutes (RAG)"), p("api-guide/recipes/statute-chatbot", "Build a statute lookup chatbot"), p("api-guide/recipes/citation-lookup", "Resolve and verify a statute citation"), p("api-guide/recipes/browse-hierarchy", "Browse the statute hierarchy"), p("api-guide/recipes/subject-corpus", "Build a Subject Corpus"), p("api-guide/recipes/compliance-mapping", "Map a compliance requirement to the governing law"), p("api-guide/recipes/multi-state-comparison", "Compare a rule across states"), p("api-guide/recipes/coverage-monitoring", "Monitor corpus coverage and changes"), p("api-guide/recipes/citation-enrichment", "Enrich a citation database with source text"), p("api-guide/recipes/mcp-tool", "Add the corpus as an AI agent tool (MCP)")] },
];
export const integrationsNav: NavSection[] = [{ title: "Integrations", pages: [p("integrations", "Integrations")] }];
export const referenceNav: NavSection[] = [{ title: "API reference", pages: [p("api-reference", "API Reference"), ...endpoints.map((e) => p(endpointSlug(e), `${e.method} ${e.summary.replace(/\.$/, "")}`))] }];
export const indiaNav: NavSection[] = [{ title: "India API reference", pages: [p(INDIA_REF, "India API credit pricing")] }];

/** Every section, in tab order (used by the docs home page and llms.txt). */
export const docsNav: NavSection[] = [...guideNav, ...integrationsNav, ...referenceNav, ...indiaNav];

export const allDocPages: NavPage[] = docsNav.flatMap((s) => s.pages);
