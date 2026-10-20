// Phase 1 store: act-level legislation metadata from the open-india-law snapshot (CC BY 4.0), exported by scripts/acts/export-legislation.sh into
// src/data/acts/. It is a processed subset (about 10k small rows, ~2.7 MB): no section text, no regulators, no judgments. The raw dataset on the SSD
// is never read at runtime, so this works on Vercel. Swap in a Postgres store behind the same ActsStore interface when the data outgrows a bundle.
import rows from "@/data/acts/acts.legislation.json";
import meta from "@/data/acts/acts.legislation.meta.json";
import type { ActItem } from "@/data/workspaceBrowse";
import { runActsQuery } from "./query";
import type { ActsStats, ActsStore } from "./types";

// Exported nulls become absent optional fields, so rows match the ActItem contract. `year` stays number | null (358 acts have no year in the data).
const ACTS: ActItem[] = (rows as unknown as Record<string, unknown>[]).map((r) => {
  const a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) a[k] = v;
  if (!("year" in a)) a.year = null;
  return a as unknown as ActItem;
});

const stats: ActsStats = {
  source: "real", acts: meta.acts, sections: meta.sections, central: meta.central, state: meta.state,
  categories: ["central", "state"],
  statuses: ["in_force", "repealed", "spent"],
  attribution: {
    text: "Data: open-india-law (Vaquill), compiled from India Code, the Government of India's official repository.",
    url: "https://huggingface.co/datasets/vaquill/open-india-law", licence: meta.licence, snapshot: "v2026.08", generatedAt: meta.generated_at,
  },
  caveats: [
    "Central and state/UT legislation only. Regulators and judgments are not included yet.",
    `Section counts are distinct section numbers found in the data. ${meta.zero_section_count.toLocaleString("en-IN")} acts (${Math.round((100 * meta.zero_section_count) / meta.acts)}%) show 0 because their text has no section numbers, so the count is unknown, not zero.`,
    `${meta.year_missing} acts have no year in the data. Citations are the act title, not an official citation. Not legal advice; verify against the official source.`,
  ],
};

export const jsonActsStore: ActsStore = {
  source: "real",
  async list(q) { return runActsQuery(ACTS, q); },
  async stats() { return stats; },
};
