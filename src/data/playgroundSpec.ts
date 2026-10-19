// MOCK FIXTURE: a local stand-in for `GET /api/playground/spec?jurisdiction=US` from the Playground teardown (docs/PLAYGROUND-TEARDOWN.md).
//
// CONFIRMED from the teardown: the response shape ({ endpoints: [...] }), the endpoint ids / methods / paths / tags, the
// `runnable` split (25 runnable, 8 not), every field name with its `in` / `kind` / `required` / `default`, the field-key
// vocabulary, and the enum tokens quoted in the teardown (corpusType, state, matchType, documentType, ...).
// INFERRED (written here, not captured): all descriptions (paraphrased, shorter than the live ones), the endpoint display
// names other than the five the teardown quotes, the sub-group headings, the `auth` flag, the example chips other than
// the first, the enum lists for fields whose tokens the teardown did not list, and number presets other than the ones quoted.
//
// `name`, `group` and `auth` are NOT part of the confirmed spec shape; they carry UI facts the live app derives somewhere else.

export type FieldKind = "text" | "textarea" | "enum" | "number" | "boolean" | "date" | "array";
export type SpecField = {
  name: string;
  in: "query" | "body" | "path";
  kind: FieldKind;
  required?: boolean;
  description: string;
  enum?: string[];
  /** INFERRED: per-token legend shown under the field (the live UI shows `TOKEN  description` rows for corpusType / source). */
  enumLabels?: Record<string, string>;
  example?: string | number;
  default?: string | number | boolean;
  min?: number;
  max?: number;
  integer?: boolean;
  multi?: boolean;
  presets?: number[];
  maxLength?: number;
  /** INFERRED: clickable example prompts for the primary field. */
  examples?: string[];
};
export type SpecEndpoint = {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  jurisdiction: "US";
  tag: "Pricing" | "US Statutes" | "US Session Laws" | "Board Watches" | "Credits";
  summary: string;
  description: string;
  runnable: boolean;
  fields: SpecField[];
  /** INFERRED: display name shown in the picker. */
  name: string;
  /** INFERRED: sub-heading inside a tag group. */
  group?: string;
  /** INFERRED: whether the endpoint needs an API key. Confirmed only for Pricing (no key) and credits/balance (401 without). */
  auth: boolean;
};

export const STATE_CODES = ["al","ak","as","az","ar","ca","co","ct","de","dc","fl","ga","gu","hi","id","il","in","ia","ks","ky","la","me","md","ma","mi","mn","ms","mo","mt","ne","nv","nh","nj","nm","ny","nc","nd","mp","oh","ok","or","pa","pr","ri","sc","sd","tn","tx","ut","vt","vi","va","wa","wv","wi","wy"];

const CORPUS_LABELS: Record<string, string> = {
  USC: "United States Code",
  CFR: "Code of Federal Regulations",
  STATE: "state statutory codes",
  CONSTITUTION: "U.S. Constitution",
  FEDERAL_RULES: "FRCP / FRCrP / FRE / FRAP / FRBP",
  STATE_CONSTITUTION: "state constitutions",
  STATE_RULES: "state court rules",
  EXECUTIVE_ACTION: "Federal Register Presidential Documents",
  REGULATION: "state administrative regulations; pair with state",
  FEDERAL_REGISTER: "Federal Register agency rules, final and proposed",
  AGENCY_GUIDANCE: "sub-regulatory federal agency guidance",
  STATE_AGENCY_GUIDANCE: "state-issued regulatory guidance",
  SENTENCING_GUIDELINES: "US Sentencing Guidelines Manual",
  US_TAX_TREATY: "US income tax treaties and protocols",
  SESSION_LAW: "US Statutes at Large, as enacted",
};
const CORPUS = Object.keys(CORPUS_LABELS);
const BROWSE_CORPUS = ["USC", "CFR", "STATE", "REGULATION", "CONSTITUTION", "STATE_CONSTITUTION", "FEDERAL_RULES"];

type Extra = Partial<SpecField>;
const F = (name: string, where: SpecField["in"], kind: FieldKind, description: string, x: Extra = {}): SpecField => ({ name, in: where, kind, description, ...x });
// `federal` (CONFIRMED for POST /us/statutes/search: "federal to scope to USC / CFR / Constitution / federal rules") is a valid `state` value
// there. It is also accepted on the other statute endpoints whose scope can be federal (count, resolve x2, extract-citations, coverage,
// boards): INFERRED. It is not accepted on divisions (state is for state-scoped corpora) or on the session-laws `jurisdiction` fields (state acts only).
export const FEDERAL = "federal" as const;
export const STATE_FILTER_VALUES = [FEDERAL, ...STATE_CODES] as const;
export type StateFilterValue = (typeof STATE_FILTER_VALUES)[number];
/** True when `v` (case-insensitive) is `federal` or a 2-letter jurisdiction code. */
export const isStateFilterValue = (v: string): v is StateFilterValue => (STATE_FILTER_VALUES as readonly string[]).includes(v.toLowerCase());

const stateField = (where: SpecField["in"], opts: { federal?: boolean; extra?: string } = {}): SpecField =>
  F("state", where, "enum",
    opts.federal
      ? `Jurisdiction filter. A two-letter code for one of the supported US jurisdictions, or federal to scope to USC / CFR / Constitution / federal rules.${opts.extra ?? ""} Case-insensitive. An unrecognized value is rejected with 422. Omit for every jurisdiction.`
      : `Two-letter jurisdiction code.${opts.extra ?? ""} Case-insensitive. Omit for every jurisdiction.`,
    { enum: opts.federal ? [...STATE_FILTER_VALUES] : STATE_CODES, example: opts.federal ? "federal" : "tx" });
const limitField = (where: SpecField["in"], def: number, max: number): SpecField =>
  F("limit", where, "number", "Number of results to return per page.", { min: 1, max, integer: true, default: def, presets: max >= 50 ? [1, 5, 10, 20, 50] : undefined });
const offsetField = (where: SpecField["in"]): SpecField =>
  F("offset", where, "number", "How many results to skip, for paging. Check hasMore to know when there is nothing further.", { min: 0, max: 70, integer: true, default: 0, presets: [0, 5, 10, 20, 70] });
const actId = F("act_id", "path", "text", "The section's actId, as returned by search or resolve.", { required: true, example: "USC_T42_S1983" });

const base = "/api/v1";
const ep = (method: SpecEndpoint["method"], path: string, tag: SpecEndpoint["tag"], name: string, summary: string, fields: SpecField[], x: { runnable?: boolean; group?: string; auth?: boolean } = {}): SpecEndpoint => ({
  id: `${method.toLowerCase()}:${base}${path}`,
  method,
  path: `${base}${path}`,
  jurisdiction: "US",
  tag,
  name,
  summary,
  description: summary,
  runnable: x.runnable ?? true,
  group: x.group,
  auth: x.auth ?? true,
  fields,
});

export const SPEC_ENDPOINTS: SpecEndpoint[] = [
  ep("GET", "/api-credits/pricing", "Pricing", "Pricing", "Free and unauthenticated. Per-endpoint credit costs.", [
    F("region", "query", "enum", "Jurisdiction to price. US for the United States primary-law surface, IN for the India legislation surface. Defaults to the jurisdiction of the document you are reading, so a caller who does not set it gets the prices for the endpoints that document describes and nothing else.", { enum: ["US", "IN"] }),
  ], { auth: false }),

  // ---- US Statutes ----
  ep("POST", "/us/statutes/search", "US Statutes", "Search statutes", "Search across federal and state law and get back the most relevant sections with citations and links to official source documents.", [
    F("query", "body", "textarea", "Natural-language question, keywords or a citation (for example 42 U.S.C. § 1983).", { required: true, maxLength: 500, example: "insider trading penalties", examples: ["At-will termination notice", "CFR privacy rule", "California landlord entry"] }),
    F("corpusType", "body", "enum", "Restrict to one corpus, or to several by passing a list (\"corpusType\": [\"USC\", \"CFR\"]). One of:", { enum: CORPUS, enumLabels: CORPUS_LABELS, multi: true }),
    stateField("body", { federal: true }),
    F("code", "body", "text", "Restrict to specific state statutory codes, for example tx_pe for the Texas Penal Code. Values come from GET /us/statutes/divisions.", { multi: true }),
    F("article", "body", "text", "Scope a search to one or more articles. String or list.", { multi: true }),
    F("yearFrom", "body", "number", "Only return sections dated in or after this year.", { min: 1700, max: 2100, integer: true, presets: [1700, 2100] }),
    F("yearTo", "body", "number", "Only return sections dated in or before this year. A currency filter, not point-in-time retrieval.", { min: 1700, max: 2100, integer: true, presets: [1700, 2100] }),
    F("excludeRepealed", "body", "boolean", "Drop sections whose own status says they are no longer operative. This removes what is known to be dead; it does not promise the remainder is good law.", { default: false }),
    F("actStatus", "body", "enum", "Positively scope to one or more raw publisher statuses, for example repealed or in_force.", { enum: ["in_force", "repealed", "renumbered", "transferred", "expired", "superseded"], multi: true }),
    F("changedSince", "body", "date", "Only return sections with an observed change on or after this date (YYYY-MM-DD). Observed changes, not effective dates."),
    F("agency", "body", "text", "Federal Register agency slug, for example environmental-protection-agency. Pass a list to match any of several.", { multi: true }),
    F("documentType", "body", "enum", "Federal Register document stage: final (a rule in force), proposed (an NPRM) or presidential.", { enum: ["final", "proposed", "presidential"] }),
    F("publishedFrom", "body", "date", "Only return Federal Register documents published on or after this date (YYYY-MM-DD)."),
    F("publishedTo", "body", "date", "Only return Federal Register documents published on or before this date."),
    F("titleNumber", "body", "number", "Filter by USC/CFR title number (for example 42 for civil rights). Only meaningful for USC/CFR.", { min: 1, integer: true }),
    F("chapter", "body", "text", "Scope a search to one or more chapters within a title or code. Pair with titleNumber or code.", { multi: true }),
    F("part", "body", "text", "Scope a search to one or more parts within a title (for example 240 for 17 C.F.R. Part 240).", { multi: true }),
    F("source", "body", "enum", "Scope to one or more named sources within a corpus.", { enum: ["frcp", "fre", "far", "dfars", "irs_notice", "irs_rev_rul", "irs_rev_proc", "ssa_ruling", "cms_iom", "mpep", "tmep", "ofac_faq", "hhs_ocr_hipaa_faq"], multi: true }),
    F("fields", "body", "enum", "Return only these result fields, for example [\"title\", \"excerpt\"]. actId and citation are always included.", { enum: ["title", "excerpt", "citation", "actId", "corpusType", "state", "actStatus", "goodLawStatus", "sourceUrl", "parent"], multi: true }),
    // Spec default is 10 (confirmed); the live form and Code view start at 5 (confirmed), so the UI seeds 5 via `example`.
    limitField("body", 10, 50),
    offsetField("body"),
    F("includeBody", "body", "boolean", "Return the full text of every hit inline on each result's body. Cost: the search price PLUS the ordinary body price for each row that returns text.", { default: false }),
    F("excerptChars", "body", "number", "Characters of matching text to include in each result's excerpt. Default 500.", { min: 100, max: 4000, integer: true, default: 500, presets: [100, 500, 4000] }),
    F("matchType", "body", "enum", "any (default) is hybrid semantic + keyword ranking; all requires every query word; phrase matches the exact phrase.", { enum: ["any", "all", "phrase"], default: "any" }),
  ], { group: "Search" }),
  ep("POST", "/us/statutes/count", "US Statutes", "Count a scope", "How many sections sit in a jurisdiction, corpus, code, title, chapter, part, article or federal rule set.", [
    F("corpusType", "body", "enum", "Corpus to count.", { enum: CORPUS, enumLabels: CORPUS_LABELS }),
    stateField("body", { federal: true }),
    F("code", "body", "text", "A state code identifier, for example tx_pe."),
    F("article", "body", "text", "Article label."),
    F("titleNumber", "body", "number", "USC/CFR title number.", { min: 1, integer: true }),
    F("chapter", "body", "text", "Chapter number or label."),
    F("part", "body", "text", "Part number."),
    F("actStatus", "body", "enum", "Count only sections with this publisher status.", { enum: ["in_force", "repealed", "renumbered", "transferred", "expired", "superseded"] }),
    F("excludeRepealed", "body", "boolean", "Leave out sections known to be repealed.", { default: false }),
  ], { group: "Search" }),
  ep("GET", "/us/statutes/section/{act_id}", "US Statutes", "Section metadata", "Get detailed metadata for a specific statute section by its ID.", [actId], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/body", "US Statutes", "Section full text", "Get the full text of a statute section in HTML and plain text.", [
    actId,
    F("format", "query", "enum", "Which text representation to return.", { enum: ["html", "text", "both"], default: "both" }),
    F("structured", "query", "boolean", "Also return the section split into its subsections.", { default: false }),
    F("asOf", "query", "date", "Return the text as it stood on this date, where reconstruction is possible (YYYY-MM-DD)."),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/related", "US Statutes", "Neighbouring sections", "The sections immediately before and after a given section, in statutory order.", [
    actId, F("limit", "query", "number", "Neighbours to return on each side.", { min: 1, integer: true, default: 3 }),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/changes", "US Statutes", "Section change history", "The observed amendment timeline for one section.", [
    actId,
    F("limit", "query", "number", "Events per page.", { min: 1, max: 200, integer: true, default: 50 }),
    F("sinceId", "query", "number", "Only events after this change id.", { min: 0, integer: true }),
    F("beforeId", "query", "number", "Only events before this change id.", { min: 0, integer: true }),
    F("changeKind", "query", "enum", "Filter by kind of change.", { enum: ["added", "amended", "repealed", "renumbered"] }),
    F("order", "query", "enum", "Sort order.", { enum: ["asc", "desc"], default: "desc" }),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/cited-by", "US Statutes", "Cited by", "Sections that cite this section.", [
    actId, F("limit", "query", "number", "Citing sections to return.", { min: 1, max: 100, integer: true, default: 25 }),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/definitions", "US Statutes", "Defined terms", "Defined terms that apply to this section.", [actId], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/cross-state", "US Statutes", "Cross-state comparison", "How other jurisdictions word the same rule.", [
    actId, F("limit", "query", "number", "Jurisdictions to return.", { min: 1, max: 52, integer: true, default: 5 }),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/section/{act_id}/enactments", "US Statutes", "Enacting laws", "The session laws that enacted or amended this section.", [actId], { group: "Section Lookup" }),
  ep("POST", "/us/statutes/sections", "US Statutes", "Batch section metadata", "Metadata for up to 50 sections in one call. Priced per section returned.", [
    F("actIds", "body", "array", "Section actIds, one per line (up to 50).", { required: true, multi: true, example: "USC_T42_S1983" }),
    F("includeBody", "body", "boolean", "Include the full text of each section.", { default: false }),
  ], { group: "Section Lookup" }),
  ep("GET", "/us/statutes/resolve", "US Statutes", "Resolve a citation", "Turn a citation such as 42 U.S.C. § 1983 into the section it names.", [
    F("cite", "query", "text", "The citation to resolve.", { required: true, example: "42 U.S.C. § 1983" }),
    stateField("query", { federal: true }),
    F("corpusType", "query", "enum", "Narrow the lookup to one corpus.", { enum: CORPUS, enumLabels: CORPUS_LABELS }),
  ], { group: "Citations" }),
  ep("POST", "/us/statutes/resolve", "US Statutes", "Resolve citations (batch)", "Resolve many citations in one call.", [
    F("citations", "body", "array", "Citations to resolve, one per line.", { required: true, multi: true, example: "42 U.S.C. § 1983" }),
    stateField("body", { federal: true }),
    F("corpusType", "body", "enum", "Narrow the lookup to one corpus.", { enum: CORPUS, enumLabels: CORPUS_LABELS }),
  ], { group: "Citations" }),
  ep("POST", "/us/statutes/extract-citations", "US Statutes", "Extract citations", "Find the legal citations in a block of text and optionally resolve them.", [
    F("text", "body", "textarea", "The text to scan for citations.", { required: true, maxLength: 20000, example: "See 42 U.S.C. § 1983 and Cal. Civ. Code § 1950.5.", examples: ["See 42 U.S.C. § 1983 and 17 C.F.R. § 240.10b-5."] }),
    stateField("body", { federal: true }),
    F("resolve", "body", "boolean", "Resolve each citation found to a section.", { default: true }),
    F("includeUnresolved", "body", "boolean", "Also return citations that could not be resolved.", { default: true }),
  ], { group: "Citations" }),
  ep("GET", "/us/statutes/coverage", "US Statutes", "Coverage", "What is held for each jurisdiction and corpus.", [stateField("query", { federal: true })], { group: "Browse" }),
  ep("GET", "/us/statutes/divisions", "US Statutes", "Browse divisions", "Browse the statutory hierarchy one level at a time.", [
    F("corpusType", "query", "enum", "Corpus to browse. Case-insensitive.", { required: true, enum: BROWSE_CORPUS, enumLabels: CORPUS_LABELS, example: "USC" }),
    stateField("query", { extra: " Required for the state-scoped corpora." }),
    F("titleNumber", "query", "number", "USC/CFR title number to drill into.", { min: 1, integer: true, example: 42 }),
    F("code", "query", "text", "A state code identifier."),
    F("chapter", "query", "text", "Chapter to drill into."),
    F("part", "query", "text", "Part to drill into."),
    F("article", "query", "text", "Article to drill into."),
    F("excludeRepealed", "query", "boolean", "Leave out repealed divisions.", { default: false }),
    F("actStatus", "query", "enum", "Filter by publisher status.", { enum: ["in_force", "repealed", "renumbered", "transferred"] }),
    F("cursor", "query", "text", "Opaque cursor from the previous page."),
  ], { group: "Browse" }),

  // ---- US Session Laws ----
  ep("GET", "/us/session-laws/list", "US Session Laws", "List session laws", "A state's session laws, by session, signing date or effective date.", [
    F("jurisdiction", "query", "enum", "Jurisdiction to list.", { required: true, enum: STATE_CODES, example: "tx" }),
    F("session", "query", "text", "Legislative session, for example 2025."),
    F("series", "query", "enum", "Publication series.", { enum: ["regular", "special", "extraordinary"] }),
    F("instrumentType", "query", "enum", "Kind of instrument.", { enum: ["act", "resolution", "joint_resolution"] }),
    F("approvedFrom", "query", "date", "Signed on or after (YYYY-MM-DD)."),
    F("approvedTo", "query", "date", "Signed on or before (YYYY-MM-DD)."),
    F("effectiveFrom", "query", "date", "Effective on or after (YYYY-MM-DD)."),
    F("effectiveTo", "query", "date", "Effective on or before (YYYY-MM-DD)."),
    F("hasText", "query", "boolean", "Only acts whose text is held."),
    F("textStatus", "query", "enum", "State of the stored text.", { enum: ["complete", "partial", "missing"] }),
    F("isLaw", "query", "boolean", "Only instruments that became law."),
    F("enactmentOutcome", "query", "enum", "How the instrument ended.", { enum: ["enacted", "vetoed", "pending"] }),
    F("updatedSince", "query", "date", "Only acts updated on or after this date."),
    F("q", "query", "text", "Free-text filter on title."),
    F("cursor", "query", "textarea", "Opaque cursor from the previous page."),
    F("limit", "query", "number", "Acts per page.", { min: 1, max: 200, integer: true, default: 50 }),
  ], { group: "Browse" }),
  ep("POST", "/us/session-laws/search", "US Session Laws", "Search session laws", "Search state acts as passed.", [
    F("query", "body", "textarea", "What to search for.", { required: true, maxLength: 500, example: "data privacy", examples: ["data privacy", "tenant security deposit"] }),
    F("jurisdiction", "body", "enum", "Limit to one jurisdiction.", { enum: STATE_CODES }),
    F("session", "body", "text", "Legislative session."),
    F("series", "body", "enum", "Publication series.", { enum: ["regular", "special", "extraordinary"] }),
    F("instrumentType", "body", "enum", "Kind of instrument.", { enum: ["act", "resolution", "joint_resolution"] }),
    F("approvedFrom", "body", "date", "Signed on or after (YYYY-MM-DD)."),
    F("approvedTo", "body", "date", "Signed on or before (YYYY-MM-DD)."),
    limitField("body", 10, 50),
    offsetField("body"),
  ], { group: "Search" }),
  ep("GET", "/us/session-laws/{session_law_id}", "US Session Laws", "Session law", "One act: its dates, the code sections it changed, official sources.", [
    F("session_law_id", "path", "textarea", "The session law id as returned by list or search.", { required: true, example: "tx-2025-HB-1" }),
    F("jurisdiction", "query", "enum", "Jurisdiction, when the id is ambiguous.", { enum: STATE_CODES }),
  ], { group: "Lookup" }),
  ep("GET", "/us/session-laws/{session_law_id}/body", "US Session Laws", "Session law text", "Text of an act as passed, including what it struck out.", [
    F("session_law_id", "path", "textarea", "The session law id.", { required: true, example: "tx-2025-HB-1" }),
    F("cursor", "query", "textarea", "Opaque cursor from the previous page of text."),
    F("startChar", "query", "number", "Character offset to start from.", { min: 0, integer: true }),
    F("expectTextSha256", "query", "text", "Fail if the stored text no longer hashes to this value."),
  ], { group: "Lookup" }),
  ep("POST", "/us/session-laws/batch", "US Session Laws", "Batch session laws", "Fetch many acts in one call.", [
    F("ids", "body", "array", "Session law ids, one per line.", { required: true, multi: true, example: "tx-2025-HB-1" }),
    F("jurisdiction", "body", "enum", "Jurisdiction, when ids are ambiguous.", { enum: STATE_CODES }),
    F("includeBody", "body", "boolean", "Include each act's text.", { default: false }),
  ], { group: "Lookup" }),
  ep("GET", "/us/session-laws/changes", "US Session Laws", "Session law changes", "A feed of newly added or updated acts.", [
    F("sinceId", "query", "number", "Only events after this change id.", { min: 0, integer: true, default: 0 }),
    F("jurisdiction", "query", "enum", "Limit to one jurisdiction.", { enum: STATE_CODES }),
    F("limit", "query", "number", "Events per page.", { min: 1, max: 200, integer: true, default: 50 }),
  ], { group: "Lookup" }),

  // ---- Board Watches ----
  ep("GET", "/boards", "Board Watches", "List boards", "The bodies of law that can be watched.", [
    F("corpusType", "query", "text", "Filter by corpus."),
    stateField("query", { federal: true }),
    F("limit", "query", "number", "Boards per page.", { min: 1, max: 500, integer: true, default: 500 }),
    F("offset", "query", "number", "How many boards to skip.", { min: 0, integer: true, default: 0 }),
  ]),
  ep("GET", "/watches", "Board Watches", "List watches", "Your watches.", [
    F("limit", "query", "number", "Watches per page.", { min: 1, integer: true, default: 100 }),
    F("offset", "query", "number", "How many to skip.", { min: 0, integer: true, default: 0 }),
  ], { runnable: false }),
  ep("POST", "/watches", "Board Watches", "Create watch", "Watch a body of law and be told when it changes.", [
    F("corpusType", "body", "text", "Corpus to watch.", { required: true }),
    stateField("body"),
    F("channel", "body", "enum", "Delivery channel.", { enum: ["webhook", "email"], default: "webhook" }),
    F("webhookUrl", "body", "text", "HTTPS endpoint for webhook delivery."),
    F("webhookSecret", "body", "text", "Secret used to sign webhook deliveries."),
    F("emailAddress", "body", "text", "Address for email delivery."),
    F("scope", "body", "text", "Narrow what is watched."),
    F("webhookAuth", "body", "text", "Extra auth header for the webhook."),
  ], { runnable: false }),
  ep("PATCH", "/watches/{watch_id}", "Board Watches", "Update watch", "Change a watch.", [
    F("watch_id", "path", "text", "Watch id.", { required: true }),
    F("isActive", "body", "boolean", "Pause or resume."),
    F("webhookUrl", "body", "text", "New webhook URL."), F("webhookSecret", "body", "text", "New webhook secret."),
    F("scope", "body", "text", "New scope."), F("emailAddress", "body", "text", "New address."), F("webhookAuth", "body", "text", "New webhook auth."),
  ], { runnable: false }),
  ep("DELETE", "/watches/{watch_id}", "Board Watches", "Delete watch", "Delete a watch.", [F("watch_id", "path", "text", "Watch id.", { required: true })], { runnable: false }),
  ep("GET", "/watches/{watch_id}/changes", "Board Watches", "Watch changes", "Changes a watch has seen.", [
    F("watch_id", "path", "text", "Watch id.", { required: true }),
    F("limit", "query", "number", "Events per page.", { min: 1, integer: true, default: 50 }),
    F("sinceId", "query", "number", "After this change id.", { min: 0, integer: true }),
    F("beforeId", "query", "number", "Before this change id.", { min: 0, integer: true }),
    F("since", "query", "text", "Since this timestamp."),
    F("changeKind", "query", "enum", "Kind of change.", { enum: ["added", "amended", "repealed", "renumbered"] }),
    F("order", "query", "enum", "Sort order.", { enum: ["asc", "desc"], default: "desc" }),
  ], { runnable: false }),
  ep("GET", "/watches/{watch_id}/changes/{change_id}/diff", "Board Watches", "Change diff", "The diff for one change.", [
    F("watch_id", "path", "text", "Watch id.", { required: true }), F("change_id", "path", "number", "Change id.", { required: true, integer: true }),
  ], { runnable: false }),
  ep("GET", "/watches/{watch_id}/deliveries", "Board Watches", "Watch deliveries", "Delivery attempts for a watch.", [
    F("watch_id", "path", "text", "Watch id.", { required: true }), F("limit", "query", "number", "Deliveries per page.", { min: 1, integer: true, default: 50 }),
  ], { runnable: false }),
  ep("POST", "/watches/{watch_id}/test", "Board Watches", "Send test delivery", "Send a test delivery.", [F("watch_id", "path", "text", "Watch id.", { required: true })], { runnable: false }),

  // ---- Credits ----
  ep("GET", "/credits/balance", "Credits", "Credit balance", "Your remaining credits.", []),
];

// ---------------------------------------------------------------------------------------------------------------
// Pricing fixture. CONFIRMED: the envelope ({dollarPerCredit:0.01, minCredits:500, maxCredits:1000000, costs[]}), the 31 rows,
// their order, `credits` values, categories and `regions:["US"]`, and the first row's description text. The remaining
// descriptions and operation names are INFERRED paraphrases.
export const PRICING_ROWS: [string, string, number, "statutes" | "alerts" | "session_laws" | "account", string][] = [
  ["/us/statutes/search", "US Statutes Search", 4, "statutes", "Hybrid semantic + keyword search across the United States Code (USC), Code of Federal Regulations (CFR), and supported state statutory codes. Set includeBody to get each hit's full text inline, which adds the ordinary body price per row that returns text (a page of 10 is 4 + 60 = 64 credits); rows whose text cannot be resolved are not charged, so read creditsConsumed rather than computing it."],
  ["/us/statutes/section", "US Statute Section (Metadata)", 2, "statutes", "Get metadata for a specific USC, CFR, or state-code section (title, citation, hierarchy, last updated)."],
  ["/us/statutes/sections", "US Statute Sections (Batch Metadata)", 2, "statutes", "Metadata for up to 50 USC, CFR, or state-code sections in one call. Priced per section returned; sections that are not found are not charged."],
  ["/us/statutes/section/related", "US Statute Section (Neighbours)", 2, "statutes", "The sections immediately before and after a given section within its own chapter or code, in statutory order."],
  ["/us/statutes/section/body", "US Statute Section (Full Text)", 6, "statutes", "Get full text of a specific USC, CFR, or state-code section."],
  ["/us/statutes/section/cited-by", "US Statute Section (Cited By)", 2, "statutes", "Sections that cite a given section."],
  ["/us/statutes/section/definitions", "US Statute Section (Definitions)", 4, "statutes", "Defined terms that apply to a given section."],
  ["/us/statutes/section/cross-state", "US Statute Section (Cross-State)", 6, "statutes", "How other jurisdictions word the same rule."],
  ["/us/statutes/resolve", "US Statute Citation Resolve", 2, "statutes", "Resolve one or many citations to sections."],
  ["/us/statutes/extract-citations", "US Statute Citation Extraction", 2, "statutes", "Find citations in a block of text."],
  ["/us/statutes/section/enactments", "US Statute Section (Enactments)", 1, "statutes", "Session laws that enacted or amended a section."],
  ["/us/statutes/section/changes", "US Statute Section (Changes)", 1, "statutes", "Observed amendment timeline for a section."],
  ["/us/statutes/divisions", "US Statute Divisions", 1, "statutes", "Browse the statutory hierarchy."],
  ["/us/statutes/count", "US Statute Count", 1, "statutes", "Count sections in a scope."],
  ["/us/statutes/states", "US Statute States", 0, "statutes", "Jurisdictions with statutory coverage."],
  ["/us/statutes/coverage", "US Statute Coverage", 0, "statutes", "What is held for each jurisdiction and corpus."],
  ["/us/statutes/codes", "US Statute Codes", 0, "statutes", "State codes available."],
  ["/us/statutes/laws", "US Statute Laws", 0, "statutes", "Laws index."],
  ["/boards", "Boards", 0, "alerts", "Bodies of law that can be watched."],
  ["/watches", "Watches", 0, "alerts", "Create, list, update and delete watches."],
  ["/watches/test", "Watch Test Delivery", 0, "alerts", "Send a test delivery."],
  ["/watches/changes", "Watch Changes", 0, "alerts", "Changes a watch has seen."],
  ["/watches/deliveries", "Watch Deliveries", 0, "alerts", "Delivery attempts for a watch."],
  ["/watches/changes/diff", "Watch Change Diff", 4, "alerts", "The diff for one change."],
  ["/us/session-laws", "US Session Law (Metadata)", 2, "session_laws", "One act: its dates and the code sections it changed."],
  ["/us/session-laws/body", "US Session Law (Full Text)", 6, "session_laws", "Text of an act as passed."],
  ["/us/session-laws/list", "US Session Laws List", 1, "session_laws", "List acts."],
  ["/us/session-laws/batch", "US Session Laws Batch", 2, "session_laws", "Fetch many acts."],
  ["/us/session-laws/changes", "US Session Laws Changes", 1, "session_laws", "Feed of new or updated acts."],
  ["/us/session-laws/search", "US Session Laws Search", 4, "session_laws", "Search acts as passed."],
  ["/credits/balance", "Credits Balance", 0, "account", "Your remaining credits."],
];

/** Credits an endpoint costs, by the normalised pricing key. Used for the chip next to Run. */
export function creditCost(path: string): number | null {
  const key = path.replace(/^\/api\/v1/, "").replace(/\/\{act_id\}/, "").replace(/\/\{session_law_id\}/, "").replace(/\/\{watch_id\}/g, "").replace(/\/\{change_id\}/, "");
  const row = PRICING_ROWS.find((r) => r[0] === key);
  return row ? row[2] : null;
}

export const MOCK_KEY_STORAGE = "lb_playground_mock_key";
