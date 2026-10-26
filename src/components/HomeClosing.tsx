import Link from "next/link";
import Reveal from "./Reveal";

// Home-page-only closing bands that sit above the shared footer.
export default function HomeClosing() {
  return (
    <>
      <section className="bg-accent/50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex max-w-w1152 flex-wrap items-center justify-between gap-6">
          <div className="max-w-w620">
            <h2 className="text-fs-title font-semibold tracking-tight">Working in legal aid or civil justice?</h2>
            <p className="mt-2 text-fs-lead text-muted">Verified nonprofit legal aid and public interest organizations get full access free (placeholder copy).</p>
          </div>
          <Link href="/legal-aid" className="btn btn-secondary">Apply for free access</Link>
        </div>
      </section>

      <section className="relative overflow-hidden bg-dark px-4 py-16 text-background sm:px-6 sm:py-24 lg:px-8">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,var(--primary-glow-strong),transparent_55%)]" />
        <Reveal className="relative mx-auto max-w-w1152">
          <h2 className="max-w-w760 font-serif text-fs-36 leading-tight sm:text-fs-56">Put real US law behind your product.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/legal-api" className="btn bg-background text-foreground hover:bg-white">Build on the LexBharat API</Link>
            <Link href="/docs" className="btn border border-background/40 hover:border-background">Read the docs</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
