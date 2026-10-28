// Route group for the signed-in area: the Acts & Judgments browser, Chat, Drafting, Review and Vault under /workspace (moving to the five areas in Phases 3 to 6 of docs/RESKIN-IA-PLAN.md).
// The Acts & Judgments browser serves real data (docs/ACTS-PHASE1.md, docs/JUDGMENTS-HC.md) and must not wear a mock banner.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
