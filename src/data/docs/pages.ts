// RECREATED DOCS CONTENT. ORIGINAL WORDING, STRUCTURE OBSERVED.
import { dev } from "@/lib/release";
// Page titles, field names, endpoint paths, enum values and the order of topics follow the public documentation.
// The sentences are written fresh for this build and describe how a service like this works; they are not the real
// docs and make no promise about the real service. Nothing here is executed: examples are illustrative.

export type Block =
  | { t: "p"; v: string }
  | { t: "h2"; v: string }
  | { t: "h3"; v: string }
  | { t: "code"; v: string; label?: string }
  | { t: "list"; v: string[] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "note"; v: string }
  | { t: "cards"; v: { title: string; text: string; href: string }[] }
  | { t: "linkcard"; title: string; text: string; href: string };

export type DocPage = { title: string; lead: string; blocks: Block[] };

const H = "https://api.lexbharat.example/api/v1";
const curl = (method: string, path: string, body?: string) =>
  `curl ${method === "GET" ? "-G " : `-X ${method} `}${H}${path} \\\n  -H "Authorization: Bearer lb_key_..."${body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${body}'` : ""}`;

export const docPages: Record<string, DocPage> = {
  /* ───────────── Get started ───────────── */
  "api-guide/overview": {
    title: "API Overview",
    lead: "A statutes and regulations API built for grounding AI and compliance work.",
    blocks: [
      { t: "p", v: "Every section of US primary law has a stable identifier (actId) and a citation. You can search, resolve a citation, walk a code's hierarchy, fetch full text, read amendment history, and subscribe to changes. All paths below are relative to the base URL." },
      { t: "code", label: "base URL and auth header (illustrative)", v: `${H}\nAuthorization: Bearer lb_key_...` },
      { t: "h2", v: "The main endpoints" },
      { t: "table", head: ["Endpoint", "Use it to"], rows: [["POST /us/statutes/search", "Find sections by meaning and keywords"], ["GET /us/statutes/resolve", "Turn a citation into a section"], ["GET /us/statutes/divisions", "Walk the hierarchy one level at a time"], ["GET /us/statutes/section/{actId}", "Read a section's metadata"], [".../body", "Read the full text"], [".../related", "Read the neighbouring sections"], ["GET /us/statutes/coverage", "See what is actually held"]] },
      { t: "h2", v: "Where to go next" },
      { t: "list", v: ["Quickstart: make a first call.", "Authentication: keys and errors.", "Core concepts: corpus types, jurisdictions, citations, identifiers.", "Recipes: end-to-end patterns such as RAG grounding and a statute chatbot."] },
    ],
  },
  "api-guide/quickstart": {
    title: "Quickstart",
    lead: "Search US statutes and fetch a section in a few minutes.",
    blocks: [
      { t: "h2", v: "1. Get an API key" },
      { t: "p", v: "Create an account and generate a key in the dashboard. Keys start with a fixed prefix so they are easy to spot in logs." + dev(" (Mock: this build has no accounts.)") },
      { t: "h2", v: "2. Make your first search" },
      { t: "code", label: "curl (illustrative)", v: curl("POST", "/us/statutes/search", '{ "query": "security deposit return", "corpusType": "STATE", "state": "ca" }') },
      { t: "p", v: "Results are ranked sections. Each carries an actId, a citation, a title and an excerpt." },
      { t: "h2", v: "3. Fetch the full text" },
      { t: "code", label: "curl (illustrative)", v: curl("GET", "/us/statutes/section/{actId}/body") },
      { t: "h2", v: "4. Discover coverage" },
      { t: "p", v: "Call the coverage endpoint to see which corpora exist for which jurisdictions before treating an empty result as an absence of law." },
      { t: "note", v: "In this local build you can try equivalent calls in the Playground. They return canned mock data." },
    ],
  },
  "api-guide/authentication": {
    title: "Authentication",
    lead: "Every request carries an API key in a bearer header.",
    blocks: [
      { t: "h2", v: "API keys" },
      { t: "code", label: "header", v: "Authorization: Bearer lb_key_your_api_key_here" },
      { t: "p", v: "Keep keys on the server. Anyone holding a key can spend your credits." },
      { t: "h2", v: "Example requests" },
      { t: "code", label: "curl", v: curl("POST", "/us/statutes/search", '{ "query": "fair use" }') },
      { t: "code", label: "python", v: `import requests\nr = requests.post(\n    "${H}/us/statutes/search",\n    headers={"Authorization": "Bearer lb_key_..."},\n    json={"query": "fair use"},\n)\nprint(r.json())` },
      { t: "code", label: "javascript", v: `const r = await fetch("${H}/us/statutes/search", {\n  method: "POST",\n  headers: { Authorization: "Bearer lb_key_...", "Content-Type": "application/json" },\n  body: JSON.stringify({ query: "fair use" }),\n});` },
      { t: "h2", v: "Error codes" },
      { t: "table", head: ["Status", "Meaning"], rows: [["401", "Missing or invalid key"], ["402", "Out of credits"], ["429", "Rate limit exceeded; honour Retry-After"]] },
      { t: "h2", v: "How many keys you can hold" },
      { t: "p", v: "Each plan allows a fixed number of keys: for example one live and one test key on a smaller plan. Create a second key before revoking the first." },
      { t: "h2", v: "Rotating a key" },
      { t: "p", v: "Create a new key, deploy it, confirm traffic is using it, then revoke the old one." },
    ],
  },
  "api-guide/data-privacy": {
    title: "Data & Privacy",
    lead: "What the API stores about your requests, and for how long.",
    blocks: [
      { t: "p", v: "The design goal described publicly is to keep as little of your traffic as possible. Query text and request bodies are not persisted; they exist for the duration of the request." },
      { t: "table", head: ["Data", "Contains", "Retention"], rows: [["Request content", "Nothing (not persisted)", "Request duration only"], ["API key", "A hash and a short display prefix", "Until revoked"], ["Usage counters", "Calls per key, per day, per endpoint", "Short window"], ["Billing ledger", "Account, credits, endpoint label, timestamp", "As a billing record"], ["Alert subscriptions", "Webhook URL, encrypted secret, email, watched source", "Until deleted"]] },
      { t: "p", v: "Webhook deliveries are signed so you can verify they came from the service (see Law Change Alerts)." },
      { t: "note", v: "This page describes the public claims. This local build stores none of it." },
    ],
  },

  /* ───────────── Data coverage ───────────── */
  "api-guide/coverage": {
    title: "API Coverage",
    lead: "Exactly which US jurisdictions and corpus types the LexBharat statutes API has ingested, with live section counts",
    blocks: [
      { t: "p", v: "5.3M+ distinct sections, indexed as 20M+ retrieval passages, across federal law and all 56 states and territories." },
      { t: "p", v: "The corpus keeps growing, so this page gives magnitudes and the table below gives the measured split. For a number you can put in a contract, call the endpoint: it is free, it describes itself, and it overrides anything written here by hand." },
      { t: "code", label: "curl (illustrative)", v: `# The live, self-describing answer. Free, and authoritative over this page.\ncurl ${H}/us/statutes/coverage \\\n  -H "Authorization: Bearer lb_key_..."` },
      { t: "cards", v: [
        { title: "Federal", text: "1.5M+ sections, 15 corpora. US Code, CFR, Statutes at Large, Federal Register, adjudications, federal local court rules, and per-corpus scope limits.", href: "/docs/api-guide/coverage/federal" },
        { title: "States and territories", text: "3.8M+ sections across 56 jurisdictions: statutes, regulations, constitutions, court rules, registers, agency guidance and AG opinions.", href: "/docs/api-guide/coverage/states" },
        { title: "Agency guidance", text: "50K+ documents from 53 named federal sources, each filterable with `source`.", href: "/docs/api-guide/coverage/agency-guidance" },
        { title: "State session laws", text: "20,604 acts across 50 jurisdictions from the 2025 sessions, as enacted, with dates, veto outcome and text.", href: "/docs/api-guide/session-laws" },
      ] },
      { t: "h2", v: "What’s in the corpus" },
      { t: "p", v: "This is the only place on the page that states exact counts, so each fact appears once. The rows below were measured on the dates shown in the source notes; the endpoint above is live." },
      { t: "table", head: ["Corpus", "Jurisdictions", "Sections", "corpusType"], rows: [
        ["State statutes", "56", "2,017,497", "STATE"], ["State regulations", "56", "1,496,990", "REGULATION"], ["State court rules", "56", "71,967", "STATE_RULES"],
        ["State constitutions", "53", "13,016", "STATE_CONSTITUTION"], ["State registers (notices, not codified law)", "24", "144,903", "STATE_REGISTER"],
        ["State agency guidance", "49", "13,360", "STATE_AGENCY_GUIDANCE"], ["State AG opinions", "43", "104,572", "STATE_AG_OPINION"], ["Federal, 15 corpora", "Federal", "1,527,270", "See Federal"],
      ] },
      { t: "p", v: "State session laws are held apart from this table and served by their own endpoints. See [State Session Laws](/docs/api-guide/session-laws)." },
      { t: "p", v: "Every section is indexed for hybrid semantic and keyword search, and mirrored in several formats (HTML, PDF, XML, plain text, DOCX) where the source provides them." },
      { t: "p", v: "Counts are distinct sections, one per provision or document, which is what the coverage endpoint returns. Long documents split into several passages for retrieval, so the index holds more entries than sections. A citation lookup still resolves to one section with its full text." },
      { t: "h2", v: "Federal" },
      { t: "p", v: "15 corpus types: the US Code and the Statutes at Large, the CFR as a live compilation and as published annual editions, Federal Register rules and notices, Executive Orders, agency guidance, administrative adjudication, the Federal Rules, local court rules, the Constitution, the Sentencing Guidelines and tax treaties." },
      { t: "p", v: "[Full federal table with per-corpus scope limits →](/docs/api-guide/coverage/federal)" },
      { t: "p", v: "Agency guidance is the one corpus with a source registry behind it: many named sources behind the single `AGENCY_GUIDANCE` token, each narrowable with `source`. [Source registry →](/docs/api-guide/coverage/agency-guidance)" },
      { t: "h2", v: "State and territory matrix" },
      { t: "p", v: "56 jurisdictions: the 50 states, DC, Puerto Rico, Guam, the Northern Mariana Islands, the US Virgin Islands and American Samoa. All 56 carry statutes, regulations and court rules, and 53 carry constitutions." },
      { t: "p", v: "[Per-jurisdiction counts for all 56 →](/docs/api-guide/coverage/states)" },
      { t: "h2", v: "State administrative registers" },
      { t: "p", v: "`corpusType=STATE_REGISTER` holds the notices a state printed in its official register: proposed, adopted and emergency rule text, one document per item. It is not codified law, it is served with `goodLawStatus: \"unknown\"`, and it is never ranked as primary law." },
      { t: "p", v: "[Per-jurisdiction counts →](/docs/api-guide/coverage/states)" },
      { t: "h2", v: "State agency guidance" },
      { t: "p", v: "State-issued regulatory guidance that interprets state law, almost all of it insurance-regulator bulletins. Query it with `corpusType=STATE_AGENCY_GUIDANCE` paired with `state`. This is not a comprehensive rollout: it lands state by state." },
      { t: "p", v: "[Per-state sources and counts →](/docs/api-guide/coverage/states)" },
      { t: "h2", v: "State Attorney General opinions" },
      { t: "p", v: "Formal written opinions of a state Attorney General, construing that state’s own statutes, constitution and regulations. Query them with `corpusType=STATE_AG_OPINION` paired with `state`." },
      { t: "p", v: "These are persuasive authority, not binding law, and every section is served with `goodLawStatus: \"unknown\"`. See [Status & Currency](/docs/api-guide/concepts/status-and-currency)." },
      { t: "note", v: "The real page lists per-state notes on each jurisdiction's opinion archive. This recreation keeps only the summary above." },
      { t: "h2", v: "Refresh cadence" },
      { t: "p", v: "How often each corpus is re-pulled from its official source. Counts grow between updates, so call `GET /us/statutes/coverage` for a live figure." },
      { t: "table", head: ["Corpus", "Cadence"], rows: [["Federal", "Daily to weekly, and on amendment for the Constitution."], ["State statutes", "Most jurisdictions weekly, a few quarterly, the rest monthly."], ["State regulations", "Monthly where the publisher supports it; cadence is per state."], ["State court rules", "Monthly, for the jurisdictions that carry them."], ["State constitutions", "Monthly; they change on the order of years."], ["State AG opinions", "Monthly, per jurisdiction; an opinion is issued once and not revised."], ["State agency guidance", "Monthly, per state."]] },
      { t: "p", v: "For the age of any single source, call [GET /boards](/docs/api-guide/alerts): it is free and carries `lastRetrievedAt`, `cadence` and `retrievalStatus` per source." },
      { t: "h3", v: "Which statute cadence applies where" },
      { t: "p", v: "Jurisdictions that publish their code in a form that can be pulled whole (an official bulk export, an API, or a complete per-section fetch) are re-pulled weekly, and each run reconciles the whole code against what is stored. A few are pulled the same way on a quarterly slot. Everywhere else, statutes are re-pulled monthly or carry text as of their ingest date." },
      { t: "p", v: "A cadence is a schedule, not a promise that the last run worked: read it off `GET /boards` rather than off this page. Some jurisdictions are covered but not watchable, so they are absent from `GET /boards`; for those, read currency from `GET /us/statutes/coverage`." },
      { t: "h2", v: "Point-in-time and change history" },
      { t: "p", v: "Every corpus can be asked what it said on a past date, and the answer states whether it is a published edition or a reconstruction. See [Point-in-time law](/docs/api-guide/point-in-time)." },
      { t: "h2", v: "Detecting a change" },
      { t: "p", v: "`GET /us/statutes/coverage` is self-describing, so new corpora appear there as they land. To find sections that moved rather than corpora that appeared, use the `changedSince` filter on `POST /us/statutes/search`. See [Coverage monitoring](/docs/api-guide/recipes/coverage-monitoring) for both patterns, and [Law change alerts](/docs/api-guide/alerts) to be pushed a change instead of polling for one." },
      { t: "p", v: "Corpora that are planned but not yet served, and what is deliberately out of scope, are on the [Roadmap](/docs/api-guide/roadmap)." },
      { t: "linkcard", title: "Corpus types", text: "Every corpusType token, and how source and state combine with it.", href: "/docs/api-guide/concepts/corpus-types" },
      { t: "linkcard", title: "Open source: LexBharat/open-us-law", text: "The ingestion pipeline behind this corpus is open source under a permissive license. Build your own copy, or contribute a source.", href: "/open-us-law" },
      { t: "note", v: "Counts and cadences on this page are copied display numbers, not computed here. The prose is rewritten for this build; the headings and structure follow the public page." },
    ],
  },
  "api-guide/coverage/federal": {
    title: "Federal coverage",
    lead: "Every federal corpus served, with counts, refresh cadence and scope limits.",
    blocks: [
      { t: "p", v: "Each federal body is a corpusType. The US Code is served at the current release point, and responses carry a currentThrough date so you know how fresh the text is." },
      { t: "table", head: ["corpusType", "What it is", "Refresh"], rows: [["USC", "United States Code", "Weekly"], ["CFR", "Code of Federal Regulations", "Daily"], ["FEDERAL_REGISTER", "Daily rules and notices", "Daily"], ["SESSION_LAW", "Statutes as enacted", "Per release"], ["AGENCY_GUIDANCE", "Agency interpretive material", "Per source"]] },
      { t: "code", label: "currentThrough (illustrative)", v: `{ "citation": "42 U.S.C. § 1983", "currentThrough": "2026-09-18" }` },
      { t: "note", v: "Counts shown in the home-page map and stats are copied display numbers, not computed here." },
    ],
  },
  "api-guide/coverage/states": {
    title: "State and territory coverage",
    lead: "Per-jurisdiction counts for statutes, regulations, constitutions and court rules across all 56 US jurisdictions.",
    blocks: [
      { t: "p", v: "State material is selected with corpusType plus a two-letter state code." },
      { t: "table", head: ["corpusType", "Meaning"], rows: [["STATE", "Statutes"], ["REGULATION", "Administrative regulations"], ["STATE_CONSTITUTION", "State constitutions"], ["STATE_RULES", "Court rules"]] },
      { t: "code", label: "example body", v: `{ "query": "landlord retaliation", "corpusType": "STATE", "state": "ms" }` },
      { t: "p", v: "The home page's map shows per-state statute counts; hover a tile to read one." },
    ],
  },
  "api-guide/coverage/agency-guidance": {
    title: "Agency guidance sources",
    lead: "Named federal sources behind AGENCY_GUIDANCE, each independently filterable.",
    blocks: [
      { t: "p", v: "Guidance is how agencies describe how they read their own rules. It is not binding law and is stored separately from law that is." },
      { t: "code", label: "filtering by source", v: `{ "query": "tip credit", "corpusType": "AGENCY_GUIDANCE", "source": "whd_foh" }` },
      { t: "p", v: "Use the coverage endpoint to list the available source values." },
    ],
  },
  "api-guide/coverage/india": {
    title: "India legislation coverage",
    lead: "What an India legislation API holds: acts, sections, jurisdictions and the depth of the amendment record.",
    blocks: [
      { t: "p", v: "A separate coverage endpoint answers for India. Records are grouped by category (central, state, regulatory) and by jurisdiction." },
      { t: "table", head: ["Field", "Meaning"], rows: [["category", "central, state or regulatory"], ["state", "Jurisdiction slug"], ["corpusType", "Kind of record"]] },
      { t: "note", v: "Figures for India appear on the /in page. This build has no India API." },
    ],
  },
  "api-guide/session-laws": {
    title: "State Session Laws",
    lead: "Session laws as enacted: acts with dates, outcome, sources, full text and search.",
    blocks: [
      { t: "p", v: "A code tells you what the law says now. A session law tells you what changed and when: signing date, effective dates and the text as passed, including struck words." },
      { t: "table", head: ["Endpoint", "Does"], rows: [["GET /us/session-laws/list", "List by jurisdiction and session"], ["POST /us/session-laws/search", "Search acts"], ["GET /us/session-laws/{sessionLawId}", "One act's metadata"], ["GET /us/session-laws/{sessionLawId}/body", "The text as passed"], ["POST /us/session-laws/batch", "Several acts at once"], ["GET /us/session-laws/changes", "What changed since a date"], ["GET /us/statutes/section/{actId}/enactments", "Acts that touched a code section"]] },
    ],
  },
  "api-guide/roadmap": {
    title: "Roadmap",
    lead: "Corpora not built yet, what is deliberately out of scope, and how to detect new coverage.",
    blocks: [
      { t: "p", v: "Planned areas are listed as corpusType values that exist in the vocabulary but are not yet populated, for example state agency guidance and annual CFR editions." },
      { t: "p", v: "Do not rely on this page for dates. Poll the coverage endpoint to detect a new corpus the moment it appears." },
      { t: "code", label: "detect new coverage", v: curl("GET", "/us/statutes/coverage") },
    ],
  },
  "api-guide/changelog": {
    title: "Changelog",
    lead: "Updates and additions to the API (placeholder entries).",
    blocks: [
      { t: "h2", v: "2026-10 (placeholder)" }, { t: "list", v: ["New jurisdictions added to the coverage endpoint, including territory citation forms.", "Session-law endpoints refined."] },
      { t: "h2", v: "2026-09 (placeholder)" }, { t: "list", v: ["Open dataset snapshot v2026.09.1 published.", "Citation resolution handles more state forms."] },
      { t: "note", v: "Entries are illustrative; the real changelog's dates and items are not reproduced." },
    ],
  },
  "api-guide/use-cases": {
    title: "Use Cases",
    lead: "Which recipe to start from, by what you are building.",
    blocks: [
      { t: "table", head: ["You are building", "Start with"], rows: [["An AI answer grounded in law", "Ground an LLM answer in statutes (RAG)"], ["A citation checker", "Resolve and verify a citation"], ["A compliance mapper", "Map a requirement to the governing law"], ["A chatbot", "Build a statute lookup chatbot"], ["A multi-state comparison", "Compare a rule across states"], ["A monitored corpus", "Monitor coverage and changes"]] },
    ],
  },

  /* ───────────── Bulk, SQL & rights ───────────── */
  "api-guide/bulk-and-sql": {
    title: "Bulk and SQL access",
    lead: "Query the whole corpus as a database: columnar files in an object store, readable in place over HTTPS.",
    blocks: [
      { t: "code", label: "DuckDB sample (illustrative; placeholder URL)", v: `INSTALL httpfs; LOAD httpfs;\nSELECT citation, section_title, word_count\nFROM read_parquet('https://data.lexbharat.example/v2026.09.1/us_ak_constitutions.parquet')\nLIMIT 5;` },
      { t: "h2", v: "Parquet files" }, { t: "p", v: "The corpus is split into one file per jurisdiction and kind of law, for example us_tx_statutes.parquet." },
      { t: "h2", v: "One combined archive" }, { t: "p", v: "A single large archive contains all files for those who prefer to download everything." },
      { t: "h2", v: "A manifest with checksums" }, { t: "p", v: "An index.json lists every file with a SHA-256 so you can verify downloads." },
      { t: "h2", v: "Dated snapshots" }, { t: "p", v: "Files are published under a dated version folder so results are reproducible." },
    ],
  },
  "api-guide/rights-and-licensing": {
    title: "Rights and licensing",
    lead: "What you may do with the data: persist it, build indexes, show it to users, redistribute it.",
    blocks: [
      { t: "h2", v: "Retrieved through the API" }, { t: "p", v: "Terms depend on your plan: attribution may be required on lower tiers and waived on higher ones." },
      { t: "h2", v: "Delivered in bulk" }, { t: "p", v: "Bulk and open-dataset use carries its own licence layers: statutory text is public domain, the compilation has its own terms, and the code that builds it is separately licensed." },
      { t: "note", v: "Placeholder summary of a topic that real documents define precisely. Nothing here is a licence." },
    ],
  },

  /* ───────────── Core concepts ───────────── */
  "api-guide/concepts/search": {
    title: "How Search Works",
    lead: "Hybrid ranking, what matchType does, what gets indexed, and why search ranks rather than enumerates.",
    blocks: [
      { t: "p", v: "Search combines keyword matching with semantic similarity and returns the best matches first. It is designed to find the right section, not to list every section in a code." },
      { t: "code", label: "request", v: curl("POST", "/us/statutes/search", '{ "query": "civil rights under color of law", "corpusType": "USC" }') },
      { t: "list", v: ["Boolean operators AND, OR and NOT are supported.", "NEAR with a distance such as ~5 finds terms close together.", "matchType controls how strictly terms must match.", "Searching for a citation string? Use resolve instead of search."] },
      { t: "p", v: "To enumerate a code, walk the hierarchy with the divisions endpoint rather than paging search results." },
    ],
  },
  "api-guide/concepts/corpus-types": {
    title: "Corpus types",
    lead: "The corpusType tokens, how they scope a search, and how source narrows one further.",
    blocks: [
      { t: "table", head: ["corpusType", "Scope"], rows: [["USC", "US Code"], ["CFR", "Federal regulations"], ["STATE", "State statutes (needs state)"], ["REGULATION", "State regulations"], ["CONSTITUTION / STATE_CONSTITUTION", "Constitutions"], ["STATE_RULES", "Court rules"], ["FEDERAL_REGISTER", "Federal Register"], ["AGENCY_GUIDANCE", "Agency guidance (narrow with source)"], ["SESSION_LAW", "Acts as passed"]] },
      { t: "code", label: "narrowing with source", v: `{ "query": "tip credit", "corpusType": "AGENCY_GUIDANCE", "source": "whd_foh" }` },
      { t: "p", v: "Some corpora can also be filtered by titleNumber." },
    ],
  },
  "api-guide/concepts/jurisdictions": {
    title: "Jurisdictions & State Codes",
    lead: "Which jurisdictions are accepted and the two endpoints that show what is actually held.",
    blocks: [
      { t: "p", v: "State-level requests take a two-letter code in state, such as ca, tx or ny. Territories use their own codes (for example gu, mp, vi, as). Federal material uses the federal jurisdiction." },
      { t: "list", v: ["GET /us/statutes/coverage: what exists, with counts.", "GET /us/statutes/laws: the bodies of law available per jurisdiction."] },
    ],
  },
  "api-guide/concepts/citation-formats": {
    title: "Citation Formats",
    lead: "Which citation strings resolve, why the form a state prints is safest, and which forms are refused on purpose.",
    blocks: [
      { t: "code", label: "resolve", v: curl("GET", "/us/statutes/resolve?cite=O.C.G.A.%20%C2%A7%2051-1-6") },
      { t: "p", v: "Resolution accepts Bluebook-style forms and the forms a state's own courts print. If several forms exist for one statute, the state's own form is the safest to send." },
      { t: "table", head: ["Example forms", "Resolves to"], rows: [["Ga. Code Ann. § 51-1-6", "The same section as below"], ["O.C.G.A. § 51-1-6", "Georgia, title 51, section 1-6"], ["Wash. Rev. Code § 59.18.060 / RCW 59.18.060", "Washington residential landlord-tenant section"]] },
      { t: "p", v: "Ambiguous or incomplete citations are refused rather than guessed." },
    ],
  },
  "api-guide/concepts/citation-quality": {
    title: "Citation resolution quality",
    lead: "How often a citation resolves correctly, how often wrongly, and where coverage is thinner.",
    blocks: [
      { t: "p", v: "Each resolution reports a matchLevel so you can treat exact, partial and fuzzy matches differently. Quality is measured on a sample set and reported per jurisdiction." },
      { t: "p", v: "Court-rule style citations and pin cites such as “at 12” or subsection markers like (a)(2) are common failure areas." },
      { t: "note", v: "The measured rates on the real page are not reproduced." },
    ],
  },
  "api-guide/concepts/section-ids": {
    title: "Section Identifiers",
    lead: "The actId canonical id, the fields that describe a section's place in the hierarchy, and moving from search to full text.",
    blocks: [
      { t: "code", label: "examples of the format", v: "USC_T42_C21_S1983\nCFR_T17_P240_S240_10b5_1\nUSC_T15_C1_S1" },
      { t: "p", v: "An actId encodes where the section sits (title, chapter, part, section). Because of that, ids should come from the API and not be hand-built from a citation." },
      { t: "list", v: ["Search or resolve returns an actId.", "GET /us/statutes/section/{actId} returns metadata.", ".../body returns the text."] },
    ],
  },
  "api-guide/concepts/section-intelligence": {
    title: "Section Intelligence",
    lead: "Four routes that answer questions about a section you already have.",
    blocks: [
      { t: "table", head: ["Route", "Answers"], rows: [["/section/{actId}/changes", "How has this section changed?"], ["/section/{actId}/cited-by", "What cites it?"], ["/section/{actId}/definitions", "What do its terms mean?"], ["/section/{actId}/cross-state", "How do other states word it?"]] },
      { t: "p", v: "Each is a GET under /us/statutes. A note field explains when an answer is empty for a reason." },
    ],
  },
  "api-guide/point-in-time": {
    title: "Point-in-time law",
    lead: "Retrieve law as it read on a past date, with provenance.",
    blocks: [
      { t: "code", label: "asOf", v: curl("GET", "/us/statutes/section/USC_T29_C8_S207/body?asOf=2019-06-01") },
      { t: "p", v: "Pass asOf=YYYY-MM-DD to the body endpoint. The response's source field says whether the text is live, a published edition, or a reconstruction." },
      { t: "p", v: "Reconstructed text is only as complete as the amendments that were tracked. Treat it as strong evidence, not proof." },
    ],
  },
  "api-guide/concepts/status-and-currency": {
    title: "Status & Currency",
    lead: "Tell whether a section is still good law: actStatus, the goodLawStatus verdict, and how to filter on both.",
    blocks: [
      { t: "list", v: ["actStatus values include in_force and reserved.", "goodLawStatus is a verdict about currency, separate from status.", "Both can be used as filters on search."] },
      { t: "p", v: "“Unverified” does not mean current. Report the verdict you were given, never assume." },
    ],
  },
  "api-guide/concepts/amendment-history": {
    title: "Amendment History",
    lead: "When a section changed, taken from the publisher's credit line.",
    blocks: [
      { t: "table", head: ["Field", "Meaning"], rows: [["amendmentYears", "Years in which amendments are credited"], ["lastAmendedYear", "Most recent year"], ["amendmentsCount", "How many amendments"], ["amendmentHistory", "Detailed list where available"], ["currentThrough", "How current the corpus is"]] },
      { t: "p", v: "These fields appear on search results, section metadata and batch lookups." },
    ],
  },
  "api-guide/concepts/response-fields": {
    title: "Response Fields",
    lead: "Which fields a section carries, which corpus each belongs to, and how to tell “not applicable” from “not held”.",
    blocks: [
      { t: "table", head: ["Field", "Notes"], rows: [["corpusType", "Which body of law"], ["actId", "Canonical id"], ["citation / citationShort", "Full and short citation"], ["title", "Section heading"], ["state / federal", "Jurisdiction markers"], ["actStatus", "in_force, reserved, …"]] },
      { t: "p", v: "A field that is null can mean the concept does not apply to this corpus, or that the value is not held. The docs for each field say which." },
    ],
  },
  "api-guide/concepts/formats": {
    title: "Response Formats",
    lead: "The text formats the body endpoint returns and the fields that link back to official sources.",
    blocks: [
      { t: "list", v: ["content.html: styled HTML.", "content.plain: plain text.", "sourceCredit and notes: publisher credits and annotations.", "sourceUrl: a link to the official government text."] },
      { t: "p", v: "Where a source offers a PDF, XML or DOCX version, the available field says so." },
    ],
  },

  /* ───────────── Alerts, working with the API, grounding ───────────── */
  "api-guide/alerts": {
    title: "Law Change Alerts",
    lead: "Subscribe to a jurisdiction or corpus and get a webhook or email when it changes.",
    blocks: [
      { t: "p", v: "A board is a source you can watch. A watch is your subscription to one, delivered by channel: email, webhook or both." },
      { t: "code", label: "create a watch (illustrative)", v: curl("POST", "/watches", '{ "corpusType": "STATE", "state": "wa", "channel": "both" }') },
      { t: "table", head: ["Endpoint", "Does"], rows: [["GET /boards", "List watchable sources"], ["POST /watches", "Create a watch"], ["GET /watches/{id}/changes/{changeId}/diff", "Read the exact text difference"], ["GET /watches/{watchId}/deliveries", "Inspect past deliveries"]] },
      { t: "p", v: "Each webhook carries an HMAC signature header over the raw body, so you can verify it." },
      { t: "note", v: "Try the simulated version on the Alerts page." },
    ],
  },
  "api-guide/pagination": {
    title: "Pagination",
    lead: "Offset paging and cursor paging, and which endpoints use which.",
    blocks: [
      { t: "list", v: ["Offset paging: pass limit and offset; hasMore tells you whether another page exists.", "Cursor paging: list-style feeds use sinceId and beforeId."] },
      { t: "p", v: "Stop when hasMore is false. Do not infer the end from a short page." },
    ],
  },
  "api-guide/errors": {
    title: "Errors",
    lead: "How failures are reported.",
    blocks: [
      { t: "p", v: "Errors return a JSON body with a detail field. Validation errors return a list describing which field failed." },
      { t: "code", label: "examples", v: `{ "detail": "Invalid or missing API key." }\n\n{ "detail": [ { "loc": ["body", "query"], "msg": "Field required", "type": "missing" } ] }` },
      { t: "table", head: ["Status", "Meaning"], rows: [["200", "Success"], ["400", "Invalid request"], ["401", "Missing or bad key"], ["402", "Out of credits"], ["404", "Unknown id"], ["422", "Validation failed"], ["429", "Rate limited (see Retry-After)"]] },
      { t: "p", v: "Failed requests are not charged." },
    ],
  },
  "api-guide/best-practices": {
    title: "Best Practices",
    lead: "Get better results and build resilient integrations.",
    blocks: [
      { t: "list", v: ["Scope searches with corpusType and, for states, state.", "Prefer resolve for citations and search for topics.", "Use divisions to enumerate; do not page search.", "Cache stable text, and revalidate with asOf or changedSince.", "Back off on 429 using Retry-After."] },
      { t: "code", label: "a well-scoped search", v: `{ "query": "security deposit return deadline", "corpusType": "STATE", "state": "ca" }` },
    ],
  },
  "api-guide/faq": {
    title: "FAQ",
    lead: "Short answers to what integrators ask most.",
    blocks: [
      { t: "h2", v: "How do I get every section matching a query?" },
      { t: "p", v: "Search ranks; it does not enumerate. Walk the divisions endpoint, or page results with limit and offset until hasMore is false." },
      { t: "h2", v: "Why did a lookup return nothing?" },
      { t: "p", v: "Check coverage first. An empty result may mean the corpus is not ingested for that jurisdiction." },
      { t: "h2", v: "Can I hand-build an actId?" },
      { t: "p", v: "Avoid it. Take ids from search or resolve." },
    ],
  },
  "api-guide/grounding-llms": {
    title: "Grounding LLMs with LexBharat AI",
    lead: "Why and how to ground model answers in retrieved, authoritative statutory text.",
    blocks: [
      { t: "p", v: "A model answers better, and more safely, when it is given the text it must answer from. Retrieve sections first, pass their text as context, and ask the model to cite the actId and citation it used." },
      { t: "code", label: "retrieve with the body included", v: `{ "query": "…", "corpusType": "USC", "limit": 5, "includeBody": true }` },
      { t: "list", v: ["Quote only what was returned.", "Report currency (goodLawStatus) alongside the answer.", "Say so when nothing is found; do not fill the gap."] },
    ],
  },

  /* ───────────── Recipes ───────────── */
  "api-guide/recipes/rag-grounding": { title: "Ground an LLM answer in statutes (RAG)", lead: "Retrieve statutes, make the model answer only from them, and cite each source.", blocks: [{ t: "h2", v: "Steps" }, { t: "list", v: ["Search with includeBody: true and a small limit.", "Pass the returned text as the model's only context.", "Ask for citations that map to actId and citation.", "Fetch .../body for any section whose body came back null."] }, { t: "code", label: "retrieval call", v: curl("POST", "/us/statutes/search", '{ "query": "…", "limit": 5, "includeBody": true }') }] },
  "api-guide/recipes/statute-chatbot": { title: "Build a statute lookup chatbot", lead: "Take a question, find the best section, and answer from it.", blocks: [{ t: "list", v: ["Search with limit 1 and includeBody true.", "Scope with corpusType and state where the user names a jurisdiction.", "Show the citation and a link to the official source."] }, { t: "code", label: "python (illustrative)", v: `import requests\nBASE = "${H}/us"\nr = requests.post(f"{BASE}/statutes/search", headers={"Authorization": "Bearer lb_key_..."},\n                  json={"query": q, "limit": 1, "includeBody": True})` }] },
  "api-guide/recipes/citation-lookup": { title: "Resolve and verify a statute citation", lead: "Resolve a citation to its governing section, and check a whole document's citations in one pass.", blocks: [{ t: "list", v: ["GET resolve for one citation; POST for many.", "Handle annotated forms such as 42 U.S.C.A. § 1983.", "Flag citations that do not resolve for human review."] }, { t: "table", head: ["Example citation", "Kind"], rows: [["42 U.S.C. § 1983", "Federal statute"], ["16 C.F.R. § 444.1", "Federal regulation"], ["Del. Code Ann. tit. 13, § 1301", "State statute"]] }] },
  "api-guide/recipes/browse-hierarchy": { title: "Browse the statute hierarchy", lead: "Walk a code top to bottom with the divisions endpoint.", blocks: [{ t: "p", v: "Start at the top level for a corpus, then request children of the division you picked. Titles, chapters, parts, articles, rule sets and sections come back in statutory order." }, { t: "code", label: "first level", v: curl("GET", "/us/statutes/divisions?corpusType=USC") }] },
  "api-guide/recipes/subject-corpus": { title: "Build a Subject Corpus", lead: "Assemble every statute and regulation on one subject across jurisdictions, and keep it current.", blocks: [{ t: "list", v: ["Count first with POST /us/statutes/count to size the job.", "List the codes a jurisdiction publishes with divisions.", "Fetch bodies, then store actId with each.", "Refresh with changedSince."] }] },
  "api-guide/recipes/compliance-mapping": { title: "Map a compliance requirement to the governing law", lead: "Take a plain-language obligation and return the governing sections grouped by jurisdiction.", blocks: [{ t: "list", v: ["Pick the corpora that govern it: CFR, FEDERAL_REGISTER, AGENCY_GUIDANCE and the relevant states.", "Search each corpus.", "Fetch bodies for the top hits.", "Check coverage so you can say what was not searched."] }] },
  "api-guide/recipes/multi-state-comparison": { title: "Compare a rule across states", lead: "Get comparable provisions in other states from one section you already have.", blocks: [{ t: "code", label: "cross-state", v: curl("GET", "/us/statutes/section/{actId}/cross-state") }, { t: "p", v: "Or run one multi-state search instead of looping over jurisdictions yourself." }] },
  "api-guide/recipes/coverage-monitoring": { title: "Monitor corpus coverage and changes", lead: "Poll for changes since your last sync and diff coverage snapshots.", blocks: [{ t: "code", label: "changedSince", v: `{ "query": "…", "changedSince": "2026-09-01" }` }, { t: "p", v: "Store the coverage response each run and compare it to catch a jurisdiction gaining a corpus." }] },
  "api-guide/recipes/citation-enrichment": { title: "Enrich a citation database with source text", lead: "Batch-resolve a column of citations, fall back to search for topic rows, and attach canonical citation and text.", blocks: [{ t: "list", v: ["POST resolve for the batch.", "Search for rows that are only topics.", "Fetch bodies.", "Respect Retry-After on 429."] }] },
  "api-guide/recipes/mcp-tool": { title: "Add the corpus as an AI agent tool (MCP)", lead: "Use a hosted MCP server, or wrap the REST API as your own tool.", blocks: [{ t: "p", v: "A search_statutes style tool maps directly onto POST /us/statutes/search. Let the agent choose fields and keep actId and citation in each result so it can cite." }, { t: "p", v: "See the MCP page for the tool list and client setup snippets." }] },

  /* ───────────── Extra pages ───────────── */
  "integrations": {
    title: "Integrations",
    lead: "MCP servers, chatbots, widgets, browser extensions and automation templates that connect the API to the tools your team already uses.",
    blocks: [
      { t: "h2", v: "MCP servers" }, { t: "p", v: "Expose the corpus to AI assistants. See the MCP page." },
      { t: "h2", v: "Chatbots" }, { t: "p", v: "Placeholder: examples of chat interfaces grounded in the corpus." },
      { t: "h2", v: "Widgets" }, { t: "p", v: "Placeholder: embeddable lookup widgets." },
      { t: "h2", v: "Browser extensions" }, { t: "p", v: "Placeholder: lookup from any page." },
      { t: "h2", v: "Automation" }, { t: "p", v: "Placeholder: templates for workflow tools." },
      { t: "h2", v: "GitHub" }, { t: "p", v: "Placeholder: open-source code lives in a public repository (link inert here)." },
    ],
  },
};

/** Docs URLs that serve the same content as another page (the public site aliases them). */
export const docAliases: Record<string, string> = {
  introduction: "api-guide/overview",
  "guides/mcp-client": "api-guide/overview",
};
