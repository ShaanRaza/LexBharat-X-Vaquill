// Picks the active acts store. ACTS_SOURCE=mock forces the placeholder rows (kill switch); anything else uses the real Phase 1 data.
// Server-only: import from route handlers, not client components.
import { jsonActsStore } from "./jsonStore";
import { mockActsStore } from "./mockStore";
import type { ActsStore } from "./types";

export const getActsStore = (): ActsStore => (process.env.ACTS_SOURCE === "mock" ? mockActsStore : jsonActsStore);
export { mockActsStore };
export * from "./query";
export type * from "./types";
