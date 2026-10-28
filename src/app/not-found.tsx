import { Button, Logo } from "@/components/kit";

// Branded 404 for every unmatched URL.
export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="outline-none min-h-screen bg-background px-4 py-16">
      <div className="mx-auto flex max-w-w560 flex-col items-center text-center">
        <Logo href="/" />
        <p className="mt-16 font-mono text-fs-xs uppercase tracking-caps-xwide text-primary">Error 404</p>
        <h1 className="mt-3 text-fs-40 font-semibold tracking-brand">This page doesn’t exist</h1>
        <p className="mt-3 text-fs-17 text-muted">The address may be mistyped, or the page may have moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button href="/" variant="primary">Back to LexBharat</Button>
        </div>
      </div>
    </main>
  );
}
