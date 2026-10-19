// SIMULATED DATABASE: an in-memory list that lives in the Node process.
// It resets whenever the dev server restarts. Nothing is written to disk and nothing leaves this computer.
// It exists so the "Law Change Alerts" demo can show create / list / delete behaving like a real service.

export type Watch = { id: string; source: string; delivery: "webhook" | "email" | "both"; target: string; createdAt: string; _mock: true };

const g = globalThis as unknown as { __lbWatches?: Watch[] };
export const watches: Watch[] = (g.__lbWatches ??= [
  { id: "w_seed_1", source: "Washington statutes", delivery: "email", target: "you@company.com", createdAt: "2026-10-01T09:00:00Z", _mock: true },
]);

export function addWatch(w: Omit<Watch, "id" | "createdAt" | "_mock">): Watch {
  const rec: Watch = { ...w, id: `w_${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), _mock: true };
  watches.unshift(rec);
  return rec;
}

export function removeWatch(id: string): boolean {
  const i = watches.findIndex((w) => w.id === id);
  if (i < 0) return false;
  watches.splice(i, 1);
  return true;
}

export const watchableSources = [
  "Washington statutes", "California statutes", "Texas statutes", "New York statutes",
  "Federal Register", "eCFR (Code of Federal Regulations)", "US Code", "Federal agency guidance",
];
