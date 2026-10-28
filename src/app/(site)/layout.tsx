import { PublicFooter, PublicHeader } from "@/components/PublicFrame";

// Frame of the public pages (Privacy, Terms, Security). Interim until Phase 7 of docs/RESKIN-IA-PLAN.md.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main id="main" tabIndex={-1} className="outline-none relative">{children}</main>
      <PublicFooter />
    </>
  );
}
