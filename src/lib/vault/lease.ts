// A per-document "being worked on" mark that expires. On Vercel a step that is cut off at the time limit never reaches its `finally`, and a reused instance would otherwise answer "busy" for that document forever.
const LEASE_MS = 90_000;
export type Leases = Map<string, number>;
/** True if `id` was free (or its mark had expired) and is now marked; false if another step is still working on it. */
export const takeLease = (leases: Leases, id: string, now = Date.now()) => { const t = leases.get(id); if (t !== undefined && now - t < LEASE_MS) return false; leases.set(id, now); return true; };
