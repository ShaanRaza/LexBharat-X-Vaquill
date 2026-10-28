// Route group for the app's pages: Desk (/), Ask, Search, Library (with the law and judgment pages) and Work (Drafts, Reviews, Vault). See docs/RESKIN-IA-PLAN.md, section 1.5.
// The Acts & Judgments browser serves real data (docs/ACTS-PHASE1.md, docs/JUDGMENTS-HC.md) and must not wear a mock banner.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
