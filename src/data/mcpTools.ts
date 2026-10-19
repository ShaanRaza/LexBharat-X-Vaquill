// STATIC DATA: tool names shown on the public MCP marketing page, with paraphrased descriptions.
import { dev } from "@/lib/release";
// There is no MCP server in this project; this is only the catalog UI.

export const mcpTools = [
  ["search_us_statutes", "Search federal and state codes; filter by corpus, state and title."],
  ["resolve_statute_citation", "Turn a citation like 42 U.S.C. § 1983 into the section it names."],
  ["get_us_statute_section", "Metadata for a section: citation, hierarchy, breadcrumb, source links."],
  ["get_us_statute_section_text", "Full section text in styled HTML and plain text."],
  ["list_statute_divisions", "Browse the statutory hierarchy one level at a time."],
  ["list_statutes_coverage", "Coverage matrix: which corpora exist in which jurisdiction."],
  ["get_section_changes", "A section's amendment timeline and what changed between two dates."],
  ["resolve_statute_citations_batch", "Resolve many citations in one call."],
  ["list_session_laws", "A state's session laws, by session, signing date or effective date."],
  ["get_session_law", "One act: its dates, the code sections it changed, official sources."],
  ["get_session_law_body", "Text of an act as passed, including what it struck out."],
  ["create_watch", "Watch a body of law and be told when it changes."],
  ["get_pricing", "Current API pricing; free, no authentication."],
] as const;

export const mcpClients = ["Claude (remote)", "Claude Desktop", "Claude Code", "Cursor", "VS Code"];

export const mcpSetup: Record<string, string> = {
  "Claude (remote)": "Add the connector from the directory in one click." + dev(" (Mock: no connector exists in this build.)"),
  "Claude Desktop": `{\n  "mcpServers": {\n    "lexbharat": {\n      "command": "lexbharat-mcp",\n      "env": { "LEXBHARAT_API_KEY": "lb_key_..." }\n    }\n  }\n}`,
  "Claude Code": `claude mcp add lexbharat -- lexbharat-mcp\n# then set LEXBHARAT_API_KEY in your environment`,
  Cursor: `{\n  "mcpServers": { "lexbharat": { "command": "lexbharat-mcp" } }\n}`,
  "VS Code": `{\n  "servers": { "lexbharat": { "type": "stdio", "command": "lexbharat-mcp" } }\n}`,
};

export const pluginCommands = [
  ["research", "Find the controlling law on a question and answer only from the text the tools return."],
  ["verify-citations", "Check every citation in a document against the official text; flag anything no longer good law."],
  ["compare-states", "How different states word the same rule, from one provision or a topic."],
  ["as-of", "A section as it stood on a past date, with provenance on how far the reconstruction can be trusted."],
  ["authority", "Trace a statute to the regulations that implement it, in either direction."],
  ["rulemaking", "Track a rulemaking: proposed, final, and when comments close."],
  ["guidance", "Federal agency guidance on a topic, and what weight it carries."],
  ["adjudications", "Federal administrative decisions, with the overruling caveat stated up front."],
  ["changed", "A one-off sweep of what moved in a corpus since a date."],
  ["coverage", "What is actually held for a jurisdiction, before reading an empty result as no law."],
] as const;
