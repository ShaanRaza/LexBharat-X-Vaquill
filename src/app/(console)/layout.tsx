// Route group for the signed-in area: the developer console demo (/developer) and the Acts & Judgments browser (/workspace).
// The "simulated" notice is NOT here any more: it lives in developer/layout.tsx, because only the developer console is simulated.
// The Acts & Judgments browser serves real data (docs/ACTS-PHASE1.md, docs/JUDGMENTS-HC.md) and must not wear a mock banner.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
