"use client";
import DraftEditor from "./DraftEditor";
import DraftForm from "./DraftForm";
import DraftingHome from "./DraftingHome";

// Picks the Drafting view from the address: /work/drafts (start), /work/drafts/new/<template> (form), /work/drafts/<id> (editor). The page has already validated the address.
export default function DraftingApp({ view, id }: { view: "home" | "form" | "editor"; id?: string }) {
  return view === "editor" ? <DraftEditor key={id} draftId={id!} /> : view === "form" ? <DraftForm key={id} templateId={id!} /> : <DraftingHome />;
}
