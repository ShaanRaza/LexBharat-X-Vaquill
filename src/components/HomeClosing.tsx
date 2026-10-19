import Link from "next/link";
import Reveal from "./Reveal";

// Home-page-only closing bands that sit above the shared footer.
export default function HomeClosing() {
  return (
    <>
      <section className="bg-accent/50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto flex max-w-[1152px] flex-wrap items-center justify-between gap-6">
          <div className="max-w-[620px]">
            <h2 className="text-[28px] font-semibold tracking-[-0.02em]">Working in legal aid or civil justice?</h2>
            <p className="mt-2 text-[16px] text-muted">Verified nonprofit legal aid and public interest organizations get full access free (placeholder copy).</p>
          </div>
          <Link href="/legal-aid" className="btn btn-secondary">Apply for free access</Link>
        </div>
      </section>

      <section className="relative overflow-hidden bg-dark px-4 py-16 text-background sm:px-6 sm:py-24 lg:px-8">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,#6e373066,transparent_55%)]" />
        <Reveal className="relative mx-auto max-w-[1152px]">
          <h2 className="max-w-[760px] font-serif text-[36px] leading-tight sm:text-[56px]">Put real US law behind your product.</h2>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/legal-api" className="btn bg-background text-foreground hover:bg-white">Build on the LexBharat API</Link>
            <Link href="/docs" className="btn border border-background/40 hover:border-background">Read the docs</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
