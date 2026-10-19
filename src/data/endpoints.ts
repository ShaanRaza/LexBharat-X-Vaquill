// STATIC DATA: API endpoints listed on the public "Statutes API" marketing page (12 of the 29 the page mentions).
// Paths are shown as the public page printed them. The descriptions are paraphrased. Nothing here calls a real API.

export type Endpoint = { group: string; method: "GET" | "POST"; path: string; summary: string; credits: number };

export const endpoints: Endpoint[] = [
  { group: "Section lookup", method: "GET", path: "/api/v1/us/statutes/resolve", summary: "Resolve a citation straight to its section.", credits: 1 },
  { group: "Section lookup", method: "GET", path: "/api/v1/us/statutes/section/{act_id}", summary: "Section metadata: citation, title, hierarchy.", credits: 1 },
  { group: "Section lookup", method: "GET", path: "/api/v1/us/statutes/section/{act_id}/body", summary: "Full section text as HTML and plain text.", credits: 2 },
  { group: "Section lookup", method: "GET", path: "/api/v1/us/statutes/section/{act_id}/related", summary: "The sections immediately before and after.", credits: 1 },
  { group: "Section lookup", method: "GET", path: "/api/v1/us/statutes/sections", summary: "Batch metadata for up to 50 sections.", credits: 5 },
  { group: "Discover the corpus", method: "GET", path: "/api/v1/us/statutes/laws", summary: "Catalog the bodies of law available, by jurisdiction.", credits: 0 },
  { group: "Discover the corpus", method: "GET", path: "/api/v1/us/statutes/divisions", summary: "Walk the statutory hierarchy one level at a time.", credits: 0 },
  { group: "Discover the corpus", method: "GET", path: "/api/v1/us/statutes/coverage", summary: "Self-describing coverage matrix.", credits: 0 },
  { group: "Search", method: "POST", path: "/us/statutes/search", summary: "Relevance-ranked search; filter by corpus, state, title.", credits: 2 },
  { group: "Alerts", method: "POST", path: "/api/v1/watches", summary: "Create a watch on a source; webhook and/or email.", credits: 0 },
  { group: "Alerts", method: "GET", path: "/api/v1/watches", summary: "List your watches.", credits: 0 },
  { group: "Pricing", method: "GET", path: "/api/v1/pricing", summary: "Current credit pricing (no auth).", credits: 0 },
];

export const endpointGroups = [...new Set(endpoints.map((e) => e.group))];
