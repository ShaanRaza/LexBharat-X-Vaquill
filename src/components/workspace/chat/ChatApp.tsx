"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Notice, Panel } from "@/components/kit";
import AnswerView from "./AnswerView";
import FeedbackBar from "../FeedbackBar";
import AttachPicker, { type Attached } from "./AttachPicker";
import type { Citation, CheckResult } from "@/lib/chat/store";

// The chat page: question box, streamed answers with citations, the honest-limits notes. Presentation and fetching only; retrieval, prompts, citations and limits are in src/lib/chat
// and src/app/api/chat. Colours, sizes and radii come from the tokens through Tailwind names and the shared kit.
type Msg = { id?: number; role: "user" | "assistant"; content: string; attached?: string[]; citations?: Citation[]; check?: CheckResult | null; pending?: boolean; error?: string; queries?: string[]; note?: string };
type Usage = { day: number; daily: number } | null;
const EXAMPLES = ["What is the punishment for cheque bounce?", "Can a minor enter into a contract?", "Maharashtra rent control: grounds for eviction"];
const MAX = 1000;

export default function ChatApp({ chatId: initialId }: { chatId?: string }) {
  const [chatId, setChatId] = useState<string | undefined>(undefined), [msgs, setMsgs] = useState<Msg[]>([]), [input, setInput] = useState(""), [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState(""), [loadErr, setLoadErr] = useState(""), [loading, setLoading] = useState(!!initialId), [usage, setUsage] = useState<Usage>(null);
  const [attached, setAttached] = useState<Attached[]>([]);
  const end = useRef<HTMLDivElement>(null), box = useRef<HTMLTextAreaElement>(null), current = useRef<string | undefined>(undefined);

  const refreshUsage = useCallback(() => { fetch("/api/chat", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (j.usage && j.limits) setUsage({ day: j.usage.day, daily: j.limits.daily }); }).catch(() => null); }, []);
  useEffect(() => { refreshUsage(); }, [refreshUsage]);
  // The address (initialId) changes either because THIS component just started a chat (its own history.replaceState: nothing to do) or because the user opened another chat or "New chat" from the sidebar (reset and load).
  useEffect(() => {
    if (initialId === current.current) return;
    current.current = initialId; setChatId(initialId); setMsgs([]); setLoadErr(""); setSendErr(""); setInput("");
    if (!initialId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/chat/${initialId}`, { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("This chat was not found on this browser.");
      const j = await r.json();
      setMsgs(j.messages.map((m: { id: number; role: "user" | "assistant"; content: string; citations: Citation[] | null; check: CheckResult | null }) => ({ id: m.id, role: m.role, content: m.content, citations: m.citations ?? [], check: m.check })));
    }).catch((e) => setLoadErr(e.message)).finally(() => setLoading(false));
  }, [initialId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function ask(question: string) {
    const q = question.replace(/\s+/g, " ").trim();
    if (q.length < 3 || busy) return;
    const sendDocs = attached; setBusy(true); setInput(""); setAttached([]);   // attachments belong to this question only
    setMsgs((m) => [...m, { role: "user", content: q, attached: sendDocs.map((d) => d.name) }, { role: "assistant", content: "", citations: [], pending: true }]);
    const patch = (f: (a: Msg) => Msg) => setMsgs((m) => { const c = [...m]; c[c.length - 1] = f(c[c.length - 1]); return c; });
    let failed = false;
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chatId, message: q, docIds: sendDocs.map((d) => d.id) }) });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(res.status === 401 ? "Your session ended. Reload the page and enter the access password again." : j.error || "Something went wrong. Please try again.");
      }
      const reader = res.body.getReader(), dec = new TextDecoder(); let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        buf += dec.decode(value ?? new Uint8Array(), { stream: !done });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line) continue;
          const e = JSON.parse(line);
          if (e.type === "start") { if (!chatId) { current.current = e.chatId; setChatId(e.chatId); window.history.replaceState(null, "", `/workspace/chat/${e.chatId}`); window.dispatchEvent(new Event("lb-chats-changed")); } }
          else if (e.type === "sources") patch((a) => ({ ...a, citations: e.sources, queries: e.queries }));
          else if (e.type === "note") patch((a) => ({ ...a, note: e.text }));
          else if (e.type === "cutoff") patch((a) => ({ ...a, check: { label: "check", unsupported: [], cutOff: true } }));
          else if (e.type === "delta") patch((a) => ({ ...a, content: a.content + e.text }));
          else if (e.type === "replace") patch((a) => ({ ...a, content: e.text }));
          else if (e.type === "check") patch((a) => ({ ...a, check: { label: e.label, unsupported: e.unsupported, missing: e.missing, unavailable: e.unavailable } }));
          else if (e.type === "done") patch((a) => ({ ...a, id: e.messageId }));
          else if (e.type === "error") { failed = true; throw new Error(e.message); }
        }
        if (done) break;
      }
      patch((a) => ({ ...a, pending: false }));
    } catch (err) {
      failed = true;
      setMsgs((m) => m.slice(0, -2)); setInput(q); setAttached(sendDocs);   // take the unanswered question back out and put it in the box so nothing is lost
      setLoadErr(""); setSendErr((err as Error).message);
    } finally { setBusy(false); window.dispatchEvent(new Event("lb-chats-changed")); refreshUsage(); if (!failed) box.current?.focus(); }
  }
  useEffect(() => { if (input === "") return; setSendErr(""); }, [input]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col">
      <Notice tone="warn" role="note" compact className="mt-2"><p><strong className="font-medium text-foreground">Testing phase:</strong> don&apos;t enter confidential client information.</p></Notice>
      <div className="flex-1 space-y-5 py-5" aria-live="polite">
        {loading && <p className="text-ui-base text-muted">Loading chat…</p>}
        {loadErr && <Notice tone="bad" role="alert"><p>{loadErr}</p></Notice>}
        {!loading && !loadErr && msgs.length === 0 && (
          <div className="pt-6">
            <h1 className="text-ui-title font-semibold">Ask about Indian law</h1>
            <p className="mt-2 text-ui-body text-secondary">Answers come only from sections of Indian Central and State Acts, with a numbered link to each section used.</p>
            <ul className="mt-5 flex flex-wrap gap-2">{EXAMPLES.map((x) => <li key={x}><button type="button" onClick={() => ask(x)} disabled={busy} className="rounded-chip bg-surface px-3 py-1.5 text-ui-base text-foreground ring-1 ring-border hover:bg-accent">{x}</button></li>)}</ul>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user"
          ? <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-card bg-primary/10 px-4 py-2.5 text-ui-body text-foreground"><p className="whitespace-pre-wrap">{m.content}</p>{!!m.attached?.length && <p className="mt-1 text-ui-sm text-secondary">Attached: {m.attached.join(", ")}</p>}</div></div>
          : <Panel as="article" key={i} className="px-card py-4">{m.pending && !m.content ? <p className="text-ui-base text-muted">Searching the Acts…</p> : <><AnswerView text={m.content} sources={m.citations ?? []} check={m.check} pending={m.pending} queries={m.queries} note={m.note} />{!m.pending && m.id && m.content ? <FeedbackBar feature="chat" itemId={String(m.id)} className="mt-4 border-t border-border/60 pt-3" /> : null}</>}</Panel>)}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 bg-background pb-4 pt-2">
        {sendErr && <Notice tone="bad" role="alert" compact className="mb-2"><p>{sendErr}</p></Notice>}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <AttachPicker value={attached} onChange={setAttached} disabled={busy} />
          {attached.map((d) => <span key={d.id} className="inline-flex max-w-full items-center gap-1 rounded-chip bg-quality-info/10 px-2 py-1 text-ui-sm text-quality-info"><span className="truncate">{d.name}</span><button type="button" onClick={() => setAttached(attached.filter((x) => x.id !== d.id))} aria-label={`Remove ${d.name}`} className="rounded-chip px-1 hover:bg-quality-info/20 focus-visible:outline-2">×</button></span>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-end gap-2">
          <label htmlFor="chat-q" className="sr-only">Your question</label>
          <textarea id="chat-q" ref={box} rows={2} maxLength={MAX} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question about an Indian Act…" disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            className="min-h-[3.25rem] flex-1 resize-none rounded-panel bg-surface px-3 py-2.5 text-ui-body text-foreground ring-1 ring-border focus-visible:outline-2 disabled:opacity-60" />
          <button type="submit" disabled={busy || input.trim().length < 3} className="h-11 rounded-panel bg-primary px-5 text-ui-base font-medium text-on-primary disabled:opacity-50">{busy ? "Working…" : "Ask"}</button>
        </form>
        <p className="mt-2 text-ui-xs text-muted">Searches Indian Acts (and any Vault documents you attach). Judgments are not included yet. Not legal advice.{usage ? ` ${Math.max(0, usage.daily - usage.day)} of ${usage.daily} questions left today.` : ""}</p>
      </div>
    </div>
  );
}
