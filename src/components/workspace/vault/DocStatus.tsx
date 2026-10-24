import { Badge } from "@/components/kit";
import type { VaultDoc } from "@/lib/vault/store";

// The status label of a document: Processing (with progress) / Ready / Can't read (with the reason). Shared by the Vault list, the Review picker and the preview.
export default function DocStatus({ doc, note }: { doc: VaultDoc; note?: string }) {
  if (doc.status === "ready") return <Badge tone="complete">Ready</Badge>;
  if (doc.status === "unreadable") return <Badge tone="bad" title={doc.statusDetail ?? undefined}>Can&apos;t read</Badge>;
  return <Badge tone="warn" title={note}>{doc.chunkCount === 0 ? "Processing… reading" : `Processing… ${doc.embeddedCount}/${doc.chunkCount}`}</Badge>;
}
