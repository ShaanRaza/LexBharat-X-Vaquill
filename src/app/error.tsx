"use client";
import Link from "next/link";

// Branded fallback if a page throws while rendering.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="outline-none min-h-screen bg-background px-4 py-24">
      <div className="mx-auto max-w-w520 text-center">
        <p className="font-mono text-fs-xs uppercase tracking-caps-xwide text-error">Something went wrong</p>
        <h1 className="mt-3 text-fs-36 font-semibold tracking-brand">This page failed to load</h1>
        <p className="mt-3 text-fs-lead text-muted">Try again. If it keeps happening, restart the dev server.</p>
        <div className="mt-8 flex justify-center gap-3">
          <button onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-secondary">Home</Link>
        </div>
      </div>
    </main>
  );
}
