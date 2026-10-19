// PLACEHOLDER DATA: structured pages recreated from the public page OUTLINE (headings and order).
import { dev } from "@/lib/release";
// The text under each heading is original placeholder copy, not the real page's wording.

export type Sec = { h: string; sub?: string[]; text?: string };
export type Structured = { slug: string; eyebrow: string; title: string; lead: string; sections: Sec[]; faq?: [string, string][] };

const t = (what: string) => `Placeholder text for “${what}”. The real page covers this topic in detail; this recreation keeps only the heading and its position on the page.`;

export const structured: Record<string, Structured> = {
  ethics: {
    slug: "ethics",
    eyebrow: "For lawyers",
    title: "AI & Lawyer Ethics",
    lead: "How professional-conduct rules apply when a lawyer uses AI tools, and how the product is designed around them. (Recreated placeholder; not legal advice.)",
    sections: [
      { h: "Plain-English summary", text: t("Plain-English summary") },
      { h: "How the product supports each rule", sub: ["Competence", "Confidentiality", "Supervision of non-lawyer assistance", "Reasonable fees", "Communication"] },
      { h: "State-by-state AI guidance", sub: ["California", "New York", "Texas", "Florida", "Illinois", "DC, New Jersey, Massachusetts"] },
      { h: "Sample templates for your firm", sub: ["Sample client disclosure letter", "Sample firm AI use policy", "Sample AI audit log template", "Sample fee disclosure language"] },
      { h: "Courts have sanctioned lawyers for AI misuse", text: t("Courts have sanctioned lawyers for AI misuse") },
    ],
    faq: [
      ["Can I ethically bill for time saved by AI?", "Placeholder answer. A real answer would discuss fee rules and client agreements."],
      ["Do I need to tell my client I’m using AI?", "Placeholder answer. A real answer would discuss disclosure and consent."],
      ["Is the product a “non-lawyer” under supervision rules?", "Placeholder answer."],
      ["How are hallucinated citations prevented?", "Placeholder answer describing layered citation checks." + dev(" (not implemented in this build)")],
    ],
  },
  "vulnerability-disclosure": {
    slug: "vulnerability-disclosure",
    eyebrow: "Security",
    title: "Vulnerability Disclosure Programme",
    lead: "How to report a security issue, what happens next, and the good-faith protections offered to researchers." + dev(" (Recreated placeholder; no real security contact exists in this build.)"),
    sections: [
      { h: "How to report", sub: ["Contact", "Please include"], text: "Send a detailed private report to security@lexbharat.example (placeholder address). Please do not file public issues." },
      { h: "Scope", sub: ["In scope", "Out of scope"], text: "In scope: the main website and its subdomains, the web application, the API. Anything else: report privately so it can be routed correctly." },
      { h: "Rules of engagement", text: "Test only against your own accounts, avoid degrading service, do not access others' data, and stop and report if you encounter personal data." },
      { h: "What to expect from us", sub: ["1. Acknowledgment, within 72 hours", "2. Triage and validation, within 5 business days", "3. Remediation, severity-dependent", "4. Coordinated public disclosure, after the fix ships"] },
      { h: "Safe harbor", sub: ["Good-faith research is welcomed", "Bug bounty"], text: t("Safe harbor") },
    ],
  },
  "legal-tech-developers": {
    slug: "legal-tech-developers",
    eyebrow: "Use case · Legal tech developers",
    title: "Stop building statute data infrastructure from scratch",
    lead: "Why teams building legal products reach for an API instead of scraping and normalizing government sources themselves.",
    sections: [
      { h: "The problem legal tech developers face today", sub: ["Sourcing US primary law is a slog", "Government formats are brittle to parse", "Hierarchy and amendment history are hard", "Data freshness is a constant battle", "Search infrastructure adds months of engineering", "No standard protocol for AI agent integration"] },
      { h: "How the API helps", sub: ["Statute search API", "Section metadata and full text", "Coverage discovery", "MCP server: native AI agent access"] },
      { h: "How it works", sub: ["Get your API key", "Explore the endpoints", "Integrate in hours, not months", "Ship and scale"] },
    ],
    faq: [
      ["What does the API cover?", "Placeholder answer. See the coverage docs."],
      ["How fresh is the data?", "Placeholder answer. See the refresh cadence on the coverage page."],
      ["What response format do the endpoints return?", "Placeholder answer: JSON, with text bodies as HTML or plain text."],
    ],
  },
};

export const wordFeatures: [string, string][] = [
  ["Contract review to tracked-change redlines", "Clause-by-clause review with severity flags; suggested edits apply as native tracked changes you can accept or reject."],
  ["Playbook-driven review", "Run your team's playbook against a draft; each redline carries a severity, a reason and a fallback."],
  ["Drafting from a brief", "Generate a first draft from a plain-English brief, or turn an instruction into a tracked-change edit."],
  ["Case-law and statute research", "Ask a legal question in the task pane and get an answer with checkable citations."],
  ["Defined terms, figures and cross-references", "Catch undefined terms, inconsistent numbers and broken cross-references before the document leaves your desk."],
  ["Compare and finalize", "Redline two versions with real tracked changes and run a final quality check."],
];

export const wordSteps = [
  "Open a document in Word on the web or Word for Mac, signed in to Microsoft 365.",
  "Download the add-in manifest file (one small .xml file) from the install guide.",
  "On the Home tab choose Add-ins → More Add-ins → Upload My Add-in, and upload the manifest.",
  "Open the task pane, sign in or create an account, and start on the open document.",
];

export const sideloadSteps: [string, string][] = [
  ["Open a document and find the Add-ins menu", "Open any document (a blank one is fine). On the Home tab, click Add-ins, then More Add-ins at the bottom of the panel."],
  ["Choose “Upload My Add-in”", "In the Office Add-ins window, use Manage My Add-ins, then Upload My Add-in."],
  ["Click Browse", "A small upload box appears. Click Browse so you can point Word at the manifest file you downloaded."],
  ["Pick the manifest.xml file", "Select the saved file and click Open. This one small file tells Word where the add-in lives."],
  ["Click Upload", "The filename appears in the box. Click Upload; the add-in appears on the ribbon in a moment."],
  ["Open the add-in and sign in", "Sign in or create an account, or switch to the bring-your-own-key tab and paste your own AI key."],
];
