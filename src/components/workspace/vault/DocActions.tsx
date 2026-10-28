import { Button } from "@/components/kit";
import { chatLink, previewLink, reviewLink } from "@/lib/vault/links.mjs";
import workspace from "@/config/workspace.json";

// What to do with a Ready document: ask about it in a new chat, review it as a contract, or read the text we extracted. Links only; the pages they open do the work.
export default function DocActions({ id, name, scanned = false }: { id: string; name: string; scanned?: boolean }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={`What to do with ${name}`}>
      <Button href={chatLink(id)} variant="primary" size="sm" aria-label={`Ask about ${name}`}>Ask about this</Button>
      {workspace.features.review.enabled && <Button href={reviewLink(id)} size="sm" aria-label={`Review ${name} as a contract`}>Review</Button>}
      <Button href={previewLink(id)} variant="ghost" size="sm" aria-label={`Preview the text of ${name}${scanned ? " (read from a scan: check the original)" : ""}`}>Preview</Button>
    </div>
  );
}
