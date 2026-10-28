import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import WorkspaceDashboard from "@/components/workspace/WorkspaceDashboard";

export const metadata: Metadata = { title: "Dashboard | LexBharat" };
export default function WorkspacePage() { return <AppShell><WorkspaceDashboard /></AppShell>; }
