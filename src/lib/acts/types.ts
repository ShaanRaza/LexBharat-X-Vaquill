import type { ActItem } from "@/data/workspaceBrowse";
import type { ActsQuery } from "./query";

export type ActsSource = "real" | "mock";
export type ActsStats = {
  source: ActsSource; acts: number; sections: number; central: number; state: number;
  /** Values that actually occur in this store, so the UI only offers filters that can match. */
  categories: string[]; statuses: string[];
  /** Present on real data only. */
  attribution?: { text: string; url: string; licence: string; snapshot: string; generatedAt: string };
  /** Plain-language limits of the data, shown to users. */
  caveats: string[];
};
/** The one interface the API routes depend on. The Phase 1 JSON store and the mock store implement it today; a hosted Postgres store can implement it later without touching routes or UI. */
export interface ActsStore {
  readonly source: ActsSource;
  list(q: ActsQuery): Promise<{ results: ActItem[]; total: number }>;
  stats(): Promise<ActsStats>;
}
