import type { Metadata } from "next";
import ConsoleShell from "@/components/console/ConsoleShell";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";

export const metadata: Metadata = { title: "Dashboard | LexBharat Legal Workspace" };
export default function WorkspacePage() { return <ConsoleShell lawTab="dashboard"><WorkspaceDashboard /></ConsoleShell>; }
