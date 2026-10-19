// MOCK DATA: a tiny made-up "corpus" that stands in for the real database behind the real API.
// The real site's database is not publicly visible. These 8 records exist only so search/resolve/playground
// can return something. Section text is PLACEHOLDER, not real statute text.

export type Section = {
  id: string; cite: string; title: string; jurisdiction: string; corpus: "US Code" | "CFR" | "State statute";
  status: "In force" | "Repealed"; edition: number; excerpt: string; lastAmended: number; source: string;
};

export const corpus: Section[] = [
  { id: "MOCK_USC_T42_S1983", cite: "42 U.S.C. § 1983", title: "Civil action for deprivation of rights", jurisdiction: "Federal", corpus: "US Code", status: "In force", edition: 2024, excerpt: "Placeholder excerpt standing in for the text of a federal civil-rights remedy.", lastAmended: 1996, source: "govinfo.example/usc/42/1983" },
  { id: "MOCK_USC_T17_S107", cite: "17 U.S.C. § 107", title: "Limitations on exclusive rights: fair use", jurisdiction: "Federal", corpus: "US Code", status: "In force", edition: 2024, excerpt: "Placeholder excerpt standing in for a copyright limitation provision.", lastAmended: 2002, source: "govinfo.example/usc/17/107" },
  { id: "MOCK_USC_T18_S1030", cite: "18 U.S.C. § 1030", title: "Fraud and related activity in connection with computers", jurisdiction: "Federal", corpus: "US Code", status: "In force", edition: 2024, excerpt: "Placeholder excerpt standing in for a computer-fraud provision.", lastAmended: 2008, source: "govinfo.example/usc/18/1030" },
  { id: "MOCK_CFR_T16_S310", cite: "16 C.F.R. § 310.4", title: "Abusive telemarketing acts or practices", jurisdiction: "Federal", corpus: "CFR", status: "In force", edition: 2025, excerpt: "Placeholder excerpt standing in for a telemarketing regulation.", lastAmended: 2015, source: "ecfr.example/16/310/4" },
  { id: "MOCK_CFR_T29_S1910", cite: "29 C.F.R. § 1910.1200", title: "Hazard communication", jurisdiction: "Federal", corpus: "CFR", status: "In force", edition: 2025, excerpt: "Placeholder excerpt standing in for a workplace-safety regulation.", lastAmended: 2024, source: "ecfr.example/29/1910/1200" },
  { id: "MOCK_CA_CIV_1946_2", cite: "Cal. Civ. Code § 1946.2", title: "Residential tenancy termination: just cause", jurisdiction: "California", corpus: "State statute", status: "In force", edition: 2025, excerpt: "Placeholder excerpt standing in for a state landlord-tenant provision.", lastAmended: 2023, source: "leginfo.example/civ/1946.2" },
  { id: "MOCK_TX_BCC_21_001", cite: "Tex. Bus. Orgs. Code § 21.001", title: "Definitions for corporations", jurisdiction: "Texas", corpus: "State statute", status: "In force", edition: 2025, excerpt: "Placeholder excerpt standing in for a state corporations definition.", lastAmended: 2019, source: "statutes.example/bo/21.001" },
  { id: "MOCK_NY_GBL_349", cite: "N.Y. Gen. Bus. Law § 349", title: "Deceptive acts and practices unlawful", jurisdiction: "New York", corpus: "State statute", status: "In force", edition: 2025, excerpt: "Placeholder excerpt standing in for a state consumer-protection provision.", lastAmended: 2002, source: "nysenate.example/gbs/349" },
];

export function findByCite(q: string): Section | undefined {
  const n = q.toLowerCase().replace(/[^a-z0-9]/g, "");
  return corpus.find((s) => s.cite.toLowerCase().replace(/[^a-z0-9]/g, "") === n);
}

export function search(q: string, filter?: { corpus?: string; jurisdiction?: string }): Section[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return corpus.filter((s) => {
    if (filter?.corpus && s.corpus !== filter.corpus) return false;
    if (filter?.jurisdiction && s.jurisdiction !== filter.jurisdiction) return false;
    const hay = `${s.cite} ${s.title} ${s.jurisdiction} ${s.excerpt}`.toLowerCase();
    return terms.length === 0 || terms.every((t) => hay.includes(t));
  });
}
