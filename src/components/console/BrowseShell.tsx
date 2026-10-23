import { cookies } from "next/headers";
import ConsoleShell from "./ConsoleShell";

// Shell for the Acts & Judgments pages, which both products use: inside the Legal Workspace it wears the workspace sidebar, inside Legal Data & API the data sidebar. The product is
// remembered in the lb_product cookie that ConsoleShell sets; with no cookie the pages keep their original (data) look.
export default async function BrowseShell({ children }: { children: React.ReactNode }) {
  const inWorkspace = (await cookies()).get("lb_product")?.value === "workspace";
  return inWorkspace ? <ConsoleShell variant="lawspace" lawTab="browse">{children}</ConsoleShell> : <ConsoleShell variant="workspace">{children}</ConsoleShell>;
}
