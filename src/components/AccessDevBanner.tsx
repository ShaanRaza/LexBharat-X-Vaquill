import { accessState } from "@/lib/access/token.mjs";

// Local development only: a thin warning strip while ACCESS_PASSWORD is not set. In production a missing password closes the site (middleware), so this never shows there.
export default function AccessDevBanner() {
  if (accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV).state !== "dev-open") return null;
  return <div role="note" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-quality-warn/10 px-4 py-2 text-center text-ui-sm text-foreground ring-1 ring-inset ring-quality-warn/30"><span className="rounded-chip bg-quality-warn px-2 py-0.5 font-mono text-ui-xs font-medium uppercase tracking-caps text-white">Local development</span><span>ACCESS_PASSWORD is not set, so this site is open to anyone who can reach it.</span></div>;
}
