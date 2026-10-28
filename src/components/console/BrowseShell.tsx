import ConsoleShell from "./ConsoleShell";

// Shell for the Acts & Judgments pages. (It used to pick a sidebar by product; there is one product now.) Replaced by the new shell in Phase 2 of docs/RESKIN-IA-PLAN.md.
export default function BrowseShell({ children }: { children: React.ReactNode }) {
  return <ConsoleShell lawTab="browse">{children}</ConsoleShell>;
}
