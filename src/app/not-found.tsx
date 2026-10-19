import Link from "next/link";
import { Wordmark } from "@/components/Nav";

// Branded 404 for every unmatched URL.
export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="outline-none min-h-screen bg-background px-4 py-16">
      <div className="mx-auto flex max-w-[560px] flex-col items-center text-center">
        <Wordmark />
        <p className="mt-16 font-mono text-[12px] uppercase tracking-[0.14em] text-primary">Error 404</p>
        <h1 className="mt-3 text-[40px] font-semibold tracking-[-0.03em]">This page doesn’t exist</h1>
        <p className="mt-3 text-[17px] text-muted">The address may be mistyped, or the page may not be part of this local build.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">Back to home</Link>
          <Link href="/docs" className="btn btn-secondary">Read the docs</Link>
          <Link href="/contact" className="btn btn-secondary">Contact</Link>
        </div>
      </div>
    </main>
  );
}
