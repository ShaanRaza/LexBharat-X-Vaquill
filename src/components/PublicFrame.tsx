import Link from "next/link";
import { Logo } from "@/components/kit";

// Interim frame for the three public pages that stay (Privacy, Terms, Security): the logo, a way back, and a footer with the other two pages and the dataset credit. It replaces the copied marketing
// nav and footer (Phase 1). Phase 7 of docs/RESKIN-IA-PLAN.md gives these pages their final layout and truthful text. Presentation only; colours and sizes come from the tokens.
const LINKS = [{ href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }, { href: "/security", label: "Security" }];

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-w1152 items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
      <Logo href="/" />
      <Link href="/" className="text-ui-base text-primary hover:underline">Back to LexBharat</Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mx-auto max-w-w1152 border-t border-border px-4 py-8 text-ui-sm text-muted sm:px-6 lg:px-8">
      <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-1">{LINKS.map((l) => <Link key={l.href} href={l.href} className="hover:text-primary">{l.label}</Link>)}</nav>
      <p className="mt-3">Data: <a href="https://huggingface.co/datasets/vaquill/open-india-law" className="underline" rel="noopener noreferrer" target="_blank">open-india-law</a> by Vaquill AI (CC BY 4.0). Not legal advice.</p>
    </footer>
  );
}
