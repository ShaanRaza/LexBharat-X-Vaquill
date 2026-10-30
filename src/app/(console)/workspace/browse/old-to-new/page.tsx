import type { Metadata } from "next";
import BrowseShell from "@/components/console/BrowseShell";
import OldToNew from "@/components/workspace/OldToNew";
import { WORKSPACE_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Old law to new law | ${WORKSPACE_SUFFIX}`, robots: { index: false, follow: false } };

// /workspace/browse/old-to-new: IPC/BNS, CrPC/BNSS, Evidence Act/BSA, from the one mapping file src/config/law-mapping.json.
export default function OldToNewPage() {
  return <BrowseShell><OldToNew /></BrowseShell>;
}
