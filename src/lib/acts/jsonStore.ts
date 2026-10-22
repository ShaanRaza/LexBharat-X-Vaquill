// Act-level metadata from the open-india-law snapshot (CC BY 4.0), exported into src/data/acts/ by scripts/acts/export-legislation.sh (Phase 1: central and
// state/UT legislation) and scripts/acts/export-regulations.sh (Phase 3: regulator instruments, category "regulatory"). A processed subset (about 21k small
// rows, ~6.5 MB): no section text, no judgments. The raw dataset on the SSD
// is never read at runtime, so this works on Vercel. Swap in a Postgres store behind the same ActsStore interface when the data outgrows a bundle.
import rows from "@/data/acts/acts.legislation.json";
import meta from "@/data/acts/acts.legislation.meta.json";
import regRows from "@/data/acts/acts.regulations.json";
import regMeta from "@/data/acts/acts.regulations.meta.json";
import type { ActItem } from "@/data/workspaceBrowse";
import { runActsQuery } from "./query";
import type { ActsStats, ActsStore } from "./types";

// Exported nulls become absent optional fields, so rows match the ActItem contract. `year` stays number | null (358 acts have no year in the data).
// Exported nulls become absent optional fields, so rows match the ActItem contract. `year` stays number | null (see stats caveats for how many).
const toActs = (rs: unknown): ActItem[] => (rs as Record<string, unknown>[]).map((r) => {
  const a: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (v !== null && v !== undefined) a[k] = v;
  if (!("year" in a)) a.year = null;
  return a as unknown as ActItem;
});
const ACTS: ActItem[] = [...toActs(rows), ...toActs(regRows)];

const BY_ID = new Map(ACTS.map((a) => [a.actId, a]));
const zero = meta.zero_section_count + regMeta.zero_section_count, total = meta.acts + regMeta.acts;
const stats: ActsStats = {
  source: "real", acts: total, sections: meta.sections + regMeta.sections, central: meta.central, state: meta.state, regulatory: regMeta.acts,
  scope: "central and state/UT acts and regulator instruments",
  categories: ["central", "state", "regulatory"],
  states: [...new Set(ACTS.map((a) => a.state).filter((x): x is string => !!x))].sort(),
  departments: [...new Set(ACTS.map((a) => a.department).filter((x): x is string => !!x))].sort(),
  statuses: ["in_force", "repealed", "superseded", "spent"],
  attribution: {
    text: "Data: open-india-law (Vaquill AI), compiled from India Code, the Government of India's official repository, and regulator websites.",
    url: "https://huggingface.co/datasets/vaquill/open-india-law", licence: meta.licence, snapshot: "v2026.08", generatedAt: regMeta.generated_at > meta.generated_at ? regMeta.generated_at : meta.generated_at,
  },
  caveats: [
    "Central and state/UT legislation plus instruments from ten regulators (RBI, SEBI, MCA, DGFT, TRAI, MoEFCC, CPCB, IRDAI, DFS, CBIC). Tribunal orders and Law Commission reports are not included.",
    `Section counts are distinct section numbers found in the data. ${zero.toLocaleString("en-IN")} entries (${Math.round((100 * zero) / total)}%) show 0 because their text has no section numbers, so the count is unknown, not zero. Regulator entries are often circulars or notifications, not sectioned Acts.`,
    `${(meta.year_missing + regMeta.year_missing).toLocaleString("en-IN")} entries have no year in the data. Citations are the title, not an official citation. Not legal advice; verify against the official source.`,
  ],
};

export const jsonActsStore: ActsStore = {
  source: "real",
  async get(actId) { return BY_ID.get(actId) ?? null; },
  async list(q) { return runActsQuery(ACTS, q); },
  async stats() { return stats; },
};
