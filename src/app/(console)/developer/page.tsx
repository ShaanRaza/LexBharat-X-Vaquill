import type { Metadata } from "next";
import { Suspense } from "react";
import DeveloperConsole from "@/components/console/DeveloperConsole";

// Title copied from the live tab title plus a "(local mock)" suffix that is kept in release builds too.
export const metadata: Metadata = { title: "Developer API & MCP Server | Vaquill (local mock)", robots: { index: false, follow: false } };

export default function DeveloperPage() {
  return <Suspense fallback={null}><DeveloperConsole /></Suspense>;
}
