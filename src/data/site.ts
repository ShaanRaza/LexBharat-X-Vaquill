// STATIC DATA: site-wide navigation and footer structure.
// Structure observed on the public site's footer; link targets point at local routes.

export const navLinks = [
  { label: "Pricing", href: "/#pricing" },
  { label: "Open Data", href: "/open-us-law" },
  { label: "Docs", href: "/docs" },
];

export const footerGroups: Record<string, { label: string; href: string }[]> = {
  Company: [
    { label: "About", href: "/about" },
    { label: "Customers", href: "/customer" },
    { label: "Contact", href: "/contact" },
    { label: "Data Sources & Credits", href: "/partners" },
    { label: "Legal Aid & Nonprofits", href: "/legal-aid" },
    { label: "Blog", href: "/blog" },
    { label: "Engineering", href: "/engineering" },
  ],
  Developers: [
    { label: "Statutes API", href: "/legal-api" },
    { label: "White Label", href: "/white-label" },
    { label: "MCP Servers", href: "/mcp" },
    { label: "Claude Code Plugin", href: "/claude-plugin" },
    { label: "API Playground", href: "/playground" },
    { label: "Affiliate Program", href: "/affiliates" },
    { label: "Law Change Alerts", href: "/alerts" },
    { label: "API Reference", href: "/docs/api-reference" },
    { label: "Changelog", href: "/docs/api-guide/changelog" },
    { label: "Open Dataset", href: "/open-us-law" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "DPA", href: "/dpa" },
    { label: "Service Levels", href: "/sla" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Refund Policy", href: "/refund-policy" },
    { label: "Delete My Data", href: "/delete-data" },
    { label: "Security", href: "/security" },
    { label: "Accessibility", href: "/accessibility" },
  ],
};

