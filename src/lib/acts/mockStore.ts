// Fallback store: the invented placeholder rows in src/data/workspaceBrowse.ts. Selected with ACTS_SOURCE=mock.
import { MOCK_ACTS } from "@/data/workspaceBrowse";
import { runActsQuery } from "./query";
import type { ActsStore } from "./types";

export const mockActsStore: ActsStore = {
  source: "mock",
  async get(actId) { return MOCK_ACTS.find((a) => a.actId === actId) ?? null; },
  async list(q) { return runActsQuery(MOCK_ACTS, q); },
  async stats() {
    return {
      source: "mock", acts: MOCK_ACTS.length, sections: MOCK_ACTS.reduce((n, a) => n + a.sectionCount, 0),
      central: MOCK_ACTS.filter((a) => a.category === "central").length, state: MOCK_ACTS.filter((a) => a.category === "state").length,
      categories: ["central", "state", "regulatory"], statuses: ["in_force", "repealed", "superseded", "spent"],
      caveats: ["Placeholder rows only. No real corpus is behind this."],
    };
  },
};
