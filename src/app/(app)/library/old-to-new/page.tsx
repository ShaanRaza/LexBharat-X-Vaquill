import type { Metadata } from "next";
import AppShell from "@/components/shell/AppShell";
import OldToNew from "@/components/workspace/OldToNew";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Old law to new law | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /library/old-to-new: IPC/BNS, CrPC/BNSS, Evidence Act/BSA, from the one mapping file src/config/law-mapping.json. (/workspace/browse/old-to-new redirects here.)
export default function OldToNewPage() {
  return <AppShell><OldToNew /></AppShell>;
}
