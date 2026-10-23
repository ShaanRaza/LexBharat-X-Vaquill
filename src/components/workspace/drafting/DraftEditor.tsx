"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Notice, Panel } from "@/components/kit";
import { NOT_GENERATED, docToText, type Doc } from "@/lib/drafting/docmodel.mjs";
import type { DraftRow, VersionRow } from "@/lib/drafting/store";
import { Checklist, LegalBasis, WarningsPanel } from "./DraftPanels";
import { PlaceholderHighlight } from "./placeholderHighlight";

// The draft editor: edit in place, autosave, version history, retry of failed sections, export (.docx, PDF) and copy. Presentation and fetching only: the document model, the exports and the
// saving rules live in src/lib/drafting and src/app/api/drafting. Only editor features the exports understand are enabled (no links or code), so what you see is what exports.
type Full = DraftRow & { versions: VersionRow[] };
type Save = "idle" | "saving" | "saved" | "error";
const LABEL: Record<string, string> = { generated: "Generated version", checkpoint: "Earlier edit", saved: "Saved by you", "before-restore": "Before a restore" };
const at = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const BTN = "inline-flex min-h-9 items-center rounded-panel px-3 text-ui-base ring-1 ring-border hover:bg-accent focus-visible:outline-2 disabled:opacity-50";

/** A notice numbers its paragraphs straight through: after a section is filled in, every numbered list takes the number after the previous one. */
function renumber(editor: Editor) {
  let n = 1; const fixes: { pos: number; start: number }[] = [];
  editor.state.doc.forEach((node, offset) => { if (node.type.name === "orderedList") { if ((node.attrs.start ?? 1) !== n) fixes.push({ pos: offset, start: n }); n += node.childCount; } });
  if (!fixes.length) return;
  const tr = editor.state.tr; for (const f of fixes) tr.setNodeMarkup(f.pos, undefined, { ...editor.state.doc.nodeAt(f.pos)!.attrs, start: f.start });
  editor.view.dispatch(tr);
}

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;
  const B = ({ on, run, label, children }: { on: boolean; run: () => void; label: string; children: React.ReactNode }) => <button type="button" onClick={run} aria-pressed={on} aria-label={label} title={label} className={`min-h-9 min-w-9 rounded-chip px-2 text-ui-base ${on ? "bg-accent font-semibold text-foreground" : "text-secondary hover:bg-accent/60"}`}>{children}</button>;
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
      <B on={editor.isActive("bold")} run={() => editor.chain().focus().toggleBold().run()} label="Bold"><b>B</b></B>
      <B on={editor.isActive("italic")} run={() => editor.chain().focus().toggleItalic().run()} label="Italic"><i>I</i></B>
      <B on={editor.isActive("underline")} run={() => editor.chain().focus().toggleUnderline().run()} label="Underline"><u>U</u></B>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <B on={editor.isActive("heading", { level: 2 })} run={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading">H</B>
      <B on={editor.isActive("bulletList")} run={() => editor.chain().focus().toggleBulletList().run()} label="Bulleted list">•</B>
      <B on={editor.isActive("orderedList")} run={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list">1.</B>
      <span aria-hidden className="mx-1 h-5 w-px bg-border" />
      <B on={false} run={() => editor.chain().focus().undo().run()} label="Undo">↶</B>
      <B on={false} run={() => editor.chain().focus().redo().run()} label="Redo">↷</B>
    </div>
  );
}

export default function DraftEditor({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [d, setD] = useState<Full | null>(null), [err, setErr] = useState(""), [save, setSave] = useState<Save>("idle"), [savedAt, setSavedAt] = useState<string>();
  const [title, setTitle] = useState(""), [versions, setVersions] = useState<VersionRow[]>([]), [retrying, setRetrying] = useState<string | null>(null), [msg, setMsg] = useState(""), [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), dirty = useRef(false), editorRef = useRef<Editor | null>(null);

  const flush = useCallback(async () => {
    const ed = editorRef.current; if (!ed || !dirty.current) return true;
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false; setSave("saving");
    try {
      const r = await fetch(`/api/drafting/${draftId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: ed.getJSON() }), keepalive: true });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Not saved");
      setSave("saved"); setSavedAt(j.savedAt);
      fetch(`/api/drafting/${draftId}/versions`, { cache: "no-store" }).then((x) => x.json()).then((v) => { if (v?.versions) setVersions(v.versions); }).catch(() => null);   // a checkpoint may have been kept
      return true;
    } catch { dirty.current = true; setSave("error"); return false; }
  }, [draftId]);
  const schedule = useCallback(() => { dirty.current = true; setSave("saving"); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(flush, 1500); }, [flush]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ link: false, code: false, codeBlock: false, horizontalRule: false, blockquote: false, heading: { levels: [1, 2, 3] } }), PlaceholderHighlight],
    content: "", editorProps: { attributes: { "aria-label": "Draft text", role: "textbox", "aria-multiline": "true" } },
    onUpdate: () => schedule(),
  });
  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    fetch(`/api/drafting/${draftId}`, { cache: "no-store" }).then(async (r) => { if (!r.ok) throw new Error("This draft was not found on this browser."); return r.json(); })
      .then((j: Full) => { setD(j); setTitle(j.title); setVersions(j.versions); setSavedAt(j.updatedAt); }).catch((e) => setErr(e.message));
  }, [draftId]);
  // put the loaded draft into the editor ONCE per draft: later changes to `d` (a retried section, a rename) must not overwrite what is in the editor
  const loadedFor = useRef<string | null>(null);
  useEffect(() => { if (editor && d && loadedFor.current !== d.id) { loadedFor.current = d.id; editor.commands.setContent(d.doc as never, { emitUpdate: false }); } }, [editor, d]);
  useEffect(() => {   // save before the page is hidden or closed
    const hide = () => { if (document.visibilityState === "hidden") void flush(); };
    document.addEventListener("visibilitychange", hide); window.addEventListener("pagehide", hide);
    return () => { document.removeEventListener("visibilitychange", hide); window.removeEventListener("pagehide", hide); if (timer.current) clearTimeout(timer.current); void flush(); };
  }, [flush]);

  const refreshVersions = async () => { const j = await fetch(`/api/drafting/${draftId}/versions`, { cache: "no-store" }).then((r) => r.json()).catch(() => null); if (j?.versions) setVersions(j.versions); };
  async function rename() { const t = title.replace(/\s+/g, " ").trim(); if (t.length < 2 || t === d?.title) { setTitle(d?.title ?? t); return; } const r = await fetch(`/api/drafting/${draftId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: t }) }); if (r.ok) { setD((p) => (p ? { ...p, title: t } : p)); window.dispatchEvent(new Event("lb-drafts-changed")); } }
  async function saveVersion() { await flush(); const r = await fetch(`/api/drafting/${draftId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save" }) }).then((x) => x.json()).catch(() => null); if (r?.versions) { setVersions(r.versions); setMsg("Version saved."); } }
  async function restore(v: VersionRow) {
    if (!window.confirm(`Put back the version from ${at(v.createdAt)}? Your current text is kept in the history first.`)) return;
    await flush(); const r = await fetch(`/api/drafting/${draftId}/versions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "restore", versionId: v.id }) }).then((x) => x.json()).catch(() => null);
    if (r?.doc) { editor?.commands.setContent(r.doc as Doc as never, { emitUpdate: false }); setVersions(r.versions); setMsg("Version restored."); }
  }
  async function retry(sectionId: string, sectionTitle: string) {
    setRetrying(sectionId); setMsg("");
    try {
      const r = await fetch(`/api/drafting/${draftId}/section`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sectionId }) }), j = await r.json();
      if (!r.ok) throw new Error(j.error || "Could not write the section.");
      const marker = NOT_GENERATED(sectionTitle); let range: { from: number; to: number } | null = null;
      editor?.state.doc.descendants((node, pos) => { if (!range && node.type.name === "paragraph" && node.textContent === marker) { range = { from: pos, to: pos + node.nodeSize }; return false; } });
      if (range) editor?.chain().insertContentAt(range, j.nodes).run(); else editor?.chain().focus("end").insertContent(j.nodes).run();
      if (j.renumber && editor) renumber(editor);
      setD((p) => (p ? { ...p, sections: p.sections.map((s) => (s.id === sectionId ? { ...s, status: "ok", text: j.text } : s)) } : p)); setMsg(`“${sectionTitle}” written.`);
    } catch (e) { setMsg((e as Error).message); }
    setRetrying(null);
  }
  async function download(format: "docx" | "pdf") { const ok = await flush(); if (!ok) { setMsg("Could not save your latest edit, so the file was not made. Try again."); return; } window.location.assign(`/api/drafting/${draftId}/export?format=${format}`); }
  async function copy() { if (!editor) return; try { await navigator.clipboard.writeText(docToText(editor.getJSON() as Doc)); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setMsg("Copy was blocked by the browser. Select the text and copy it instead."); } }
  async function remove() { if (!window.confirm("Delete this draft? This cannot be undone.")) return; await fetch(`/api/drafting/${draftId}`, { method: "DELETE" }); window.dispatchEvent(new Event("lb-drafts-changed")); router.push("/workspace/drafting"); }

  if (err) return <Notice tone="bad" role="alert" className="mx-auto mt-6 max-w-3xl"><p>{err} <Link className="underline" href="/workspace/drafting">Back to Drafting</Link></p></Notice>;
  if (!d) return <p className="mx-auto max-w-5xl py-6 text-ui-base text-muted">Loading the draft…</p>;
  const failed = d.sections.filter((s) => s.status === "failed");
  return (
    <div className="mx-auto max-w-6xl pb-10">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Draft for review by a qualified lawyer. Not legal advice.</strong> Testing phase: don&apos;t enter confidential client information.</p></Notice>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href="/workspace/drafting" className="text-ui-sm text-primary underline">← Drafting</Link>
        <label htmlFor="draft-title" className="sr-only">Draft title</label>
        <input id="draft-title" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} maxLength={120} className="min-w-0 flex-1 rounded-chip bg-transparent px-2 py-1 text-ui-lead font-semibold hover:bg-accent/50 focus-visible:bg-surface focus-visible:outline-2" />
        <span role="status" aria-live="polite" className="text-ui-sm text-muted">{save === "saving" ? "Saving…" : save === "error" ? "Not saved. Retrying on your next edit." : savedAt ? `Saved ${at(save === "saved" || savedAt ? savedAt : new Date().toISOString())}` : ""}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Export">
        <button type="button" onClick={() => download("docx")} className={BTN}>Download .docx</button>
        <button type="button" onClick={() => download("pdf")} className={BTN}>Download PDF</button>
        <button type="button" onClick={copy} className={BTN}>{copied ? "Copied" : "Copy text"}</button>
        <button type="button" onClick={remove} className="ml-auto inline-flex min-h-9 items-center rounded-panel px-3 text-ui-sm text-muted hover:bg-accent">Delete draft</button>
      </div>
      {msg && <p role="status" className="mt-2 text-ui-sm text-secondary">{msg}</p>}
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_21rem]">
        <div>
          <div className="draft-doc rounded-card bg-surface shadow-sm ring-1 ring-border/60"><Toolbar editor={editor} /><div className="px-5 py-4 sm:px-8 sm:py-6"><EditorContent editor={editor} /></div></div>
          <p className="mt-2 text-ui-sm text-muted">Highlighted text in <span className="draft-placeholder">[CAPITALS]</span> is information that was missing: replace it before you use the draft.</p>
        </div>
        <aside className="space-y-4" aria-label="Draft information">
          <WarningsPanel warnings={d.warnings} />
          {failed.length > 0 && (
            <Panel as="section" aria-label="Sections to retry"><h3 className="text-ui-base font-semibold">Not generated</h3>
              <ul className="mt-2 space-y-2">{failed.map((s) => <li key={s.id} className="flex items-center justify-between gap-2 text-ui-sm"><span>{s.title}</span><button type="button" disabled={retrying !== null} onClick={() => retry(s.id, s.title)} className={BTN}>{retrying === s.id ? "Writing…" : "Retry"}</button></li>)}</ul></Panel>
          )}
          <LegalBasis basis={d.basis} />
          <Checklist items={d.checklist} />
          <Panel as="section" aria-label="Version history">
            <div className="flex items-center justify-between gap-2"><h3 className="text-ui-base font-semibold">Version history</h3><button type="button" onClick={saveVersion} className={BTN}>Save a version</button></div>
            <ul className="mt-2 space-y-1.5 text-ui-sm">
              <li className="flex items-center justify-between gap-2"><span><Badge tone="info">Latest edit</Badge> <span className="text-muted">{savedAt ? at(savedAt) : ""}</span></span><span className="text-muted">current</span></li>
              {versions.map((v) => <li key={v.id} className="flex items-center justify-between gap-2"><span>{LABEL[v.label] ?? v.label} <span className="text-muted">· {at(v.createdAt)}</span></span><button type="button" onClick={() => restore(v)} className="rounded-chip px-2 py-1 text-primary hover:bg-accent">Restore</button></li>)}
            </ul>
            <button type="button" onClick={refreshVersions} className="mt-2 text-ui-sm text-muted underline">Refresh</button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
