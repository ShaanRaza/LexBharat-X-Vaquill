"use client";
import DraftEditor from "./DraftEditor";
import DraftForm from "./DraftForm";
import DraftingHome from "./DraftingHome";

// Picks the Drafting view from the address: /workspace/drafting (start), /workspace/drafting/new/<template> (form), /workspace/drafting/<id> (editor). The page has already validated the address.
export default function DraftingApp({ view, id }: { view: "home" | "form" | "editor"; id?: string }) {
  return view === "editor" ? <DraftEditor key={id} draftId={id!} /> : view === "form" ? <DraftForm key={id} templateId={id!} /> : <DraftingHome />;
}
