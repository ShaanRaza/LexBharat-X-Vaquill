// The password page. Server part: tells the form whether the site is configured. A misconfigured production site shows "not configured" and no form.
import type { Metadata } from "next";
import { accessState } from "@/lib/access/token.mjs";
import AccessForm from "@/components/AccessForm";
import { Logo, Notice } from "@/components/kit";

export const metadata: Metadata = { title: "Enter the access password | LexBharat", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AccessPage() {
  const { state } = accessState(process.env as Record<string, string | undefined>, process.env.NODE_ENV);
  return (
    <main id="main" className="surface-glow flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-card bg-surface p-6 text-foreground shadow-lg ring-1 ring-white/30 sm:p-8">
        <Logo />
        <h1 className="mt-6 font-serif text-fs-34 leading-tight">Enter the access password</h1>
        {state === "misconfigured" ? (
          <Notice tone="bad" role="alert" title="Site not configured" className="mt-6"><p>This site is closed until its access password is set. Nothing can be opened right now.</p></Notice>
        ) : (
          <>
            <p className="mt-2 text-ui-body text-secondary">This site is private. Enter the access password to continue.</p>
            {state === "dev-open" && <Notice tone="warn" role="note" compact className="mt-4"><p>Local development: no access password is set, so the site is open. Set ACCESS_PASSWORD in .env.local to turn the gate on.</p></Notice>}
            <AccessForm />
          </>
        )}
      </div>
    </main>
  );
}
