// PLACEHOLDER DATA: company-page content. People, customers and quotes are FICTIONAL. No real person's bio is reproduced.

export const team = [
  { name: "Asha Placeholder", role: "Co-founder & CEO · Lawyer", bio: "Fictional bio. Spent a career inside compliance and research workflows where one wrong citation sinks the memo." },
  { name: "Ravi Placeholder", role: "Co-founder & CTO · Engineer", bio: "Fictional bio. Builds and runs the data pipeline: source-linked citations, versioned data, documented data locations." },
];

export const customers = [
  {
    slug: "example-solo-practice",
    name: "Example Solo Practice",
    tag: "Solo practice · Solo practitioner",
    title: "A simple citation checker with an API key",
    summary: "A fictional solo practitioner replaced a two-pass highlighter review with a short script that finds citations and verifies them against the API, with a local cache so revisions are cheap.",
    quote: "Placeholder quote: the piece that made statutes verifiable rather than merely findable.",
    who: "Jane Placeholder, Attorney",
    body: [
      "This is a fictional case study that mirrors the shape of a public customer story: the problem, the approach, and the result.",
      "Problem: citation review was done by hand in two passes, which was slow and easy to get wrong.",
      "Approach: a short script extracts citations from a draft, resolves each through the API, and caches the answers locally so revisions only re-check what changed.",
      "Result: a repeatable check that takes minutes. (No real metrics are claimed here.)",
    ],
  },
];

export const sources = [
  { name: "US Government Publishing Office", note: "Authoritative source for the United States Code and the Code of Federal Regulations." },
  { name: "Electronic Code of Federal Regulations", note: "Daily-updated regulations published by the Office of the Federal Register." },
  { name: "State legislature websites", note: "State and territory statute codes sourced from each official legislature publication." },
];

export const supportTopics = [
  ["Email support", "The fastest way to reach us. Include your account email and what you were trying to do."],
  ["Support hours & response times", "Placeholder: business days, with a reply target stated in the service levels page."],
  ["Documentation & guides", "Start with the quickstart, then the API reference."],
];

export const brandColors = [
  ["Background", "#f2f1ee"], ["Foreground", "#25211d"], ["Primary", "#6e3730"], ["Primary hover", "#5a2d27"],
  ["Raised", "#eae9e5"], ["Border", "#d9d8d5"], ["Dark", "#1e1b17"], ["Success", "#2f6b45"],
] as const;
