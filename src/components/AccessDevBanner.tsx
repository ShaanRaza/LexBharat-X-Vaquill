import { accessState } from "@/lib/access/token.mjs";

// Local development only: a thin warning strip while ACCESS_PASSWORD is not set. In production a missing password closes the site (middleware), so this never shows there.
export default function AccessDevBanner() {
  if (accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV).state !== "dev-open") return null;
  return <div role="note" className="bg-quality-warn/15 px-4 py-1.5 text-center text-ui-sm text-foreground">Local development: ACCESS_PASSWORD is not set, so this site is open to anyone who can reach it.</div>;
}
