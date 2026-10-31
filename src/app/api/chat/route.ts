// POST /api/chat {chatId?, message} -> streamed answer as newline-delimited JSON events:
// A question may carry docIds (up to 3 documents of this browser's Vault, for this question only): their passages are searched together with the Acts and cited as a separate kind of source.
//   {type:"start", chatId} {type:"note", text} {type:"sources", sources:[...], queries:[...]} {type:"delta", text} {type:"replace", text} {type:"cutoff"} {type:"check", label, unsupported, missing} {type:"done"} | {type:"error", code, message}
// GET  /api/chat -> this browser's chats (newest first), usage and the limits.
// Needs the access cookie (middleware) and the anonymous browser id (x-lb-bid, set by the middleware). Answers use ONLY the retrieved Act sections; the answer check labels the result.
import { dbConfigured } from "@/lib/app-db";
import { AiError, aiConfigured, aiModelFor, completeAi, streamAi } from "@/lib/ai";
import { isBrowserId } from "@/lib/access/token.mjs";
import limitConfig from "@/config/chat-limits.json";
import { evaluateLimits, readLimits } from "@/lib/chat/limits.mjs";
import { alignCitations, citedNumbers, ensureCitations, sanitizeCitations } from "@/lib/chat/citations.mjs";
import { buildChatPrompt, buildCheckPrompt, detectNotFound, parseCheck } from "@/lib/chat/prompt.mjs";
import { buildRewritePrompt, parseRewrite } from "@/lib/chat/rewrite.mjs";
import { tidyChips } from "@/lib/chat/citations.mjs";
import { dropNotFoundClaims, gapLead, gapNotice, gapKey, uniqueGaps, dropGapRepeats, unretrievedMentions } from "@/lib/chat/gaps.mjs";
import { extractLookups } from "@/lib/chat/lookups.mjs";
import { logGap } from "@/lib/insights/server";
import { searchSections } from "@/lib/legal-data";
import { officialSourceUrl } from "@/lib/acts/quality";
import { tuningFlags } from "@/lib/chat/tuning.mjs";
import { verifyCitations } from "@/lib/chat/verify.mjs";
import { answerFirst, dedupeCitations, relatedOnlyIfApplicable } from "@/lib/chat/shape.mjs";
import { fixIndiaCodeLinks } from "@/lib/docs/docType.mjs";
import { expandQuery } from "@/lib/acts/searchBoost.mjs";
import synonyms from "@/config/search-synonyms.json";
import tuningConfig from "@/config/chat-tuning.json";
import { citationOf, retrieveSources, type ChatSource } from "@/lib/chat/retrieve";
import { askNoticeFor } from "@/lib/acts/meaning.mjs";
import { docChatSources, searchAttached } from "@/lib/vault/search";
import { getDocs } from "@/lib/vault/store";
import { vaultConfigured } from "@/lib/vault/supabase";
import { bump } from "@/lib/insights/server";
import { addMessage, chatTitle, countQuestion, createChat, deleteChat, deleteMessage, isChatId, listChats, listQuestions, ownsChat, recentTurns, uncountQuestion, usageFor, type AbsentNote, type CheckResult } from "@/lib/chat/store";

export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };
const MAX_MESSAGE = 1000, MAX_ATTACH = 3;
const limits = () => readLimits(limitConfig, process.env as Record<string, string | undefined>);
const bidOf = (req: Request) => { const b = req.headers.get("x-lb-bid"); return isBrowserId(b) ? b : null; };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...noStore, ...extra } });

export async function GET(req: Request) {
  const bid = bidOf(req);
  if (!bid) return json({ error: "No browser id." }, 400);
  if (!dbConfigured()) return json({ chats: [], configured: false });
  // ?questions=1: this browser's recent questions (the Ask page shows them); it reads nothing but the saved chats and never depends on the usage counters
  if (new URL(req.url).searchParams.get("questions") === "1") {
    try { return json({ configured: true, questions: await listQuestions(bid, 8) }); } catch { return json({ questions: [], configured: true, error: "Could not load your questions." }, 503); }
  }
  try {
    const [chats, used] = await Promise.all([listChats(bid), usageFor(bid)]);
    const l = limits();
    return json({ configured: true, chats, usage: { day: used.day, week: used.week }, limits: { daily: l.daily, weekly: l.weekly } });
  } catch { return json({ chats: [], configured: true, error: "Could not load your chats." }, 503); }
}

export async function POST(req: Request) {
  const bid = bidOf(req);
  if (!bid) return json({ error: "No browser id." }, 400);
  const body = (await req.json().catch(() => null)) as { chatId?: unknown; message?: unknown; docIds?: unknown } | null;
  const docIds = Array.isArray(body?.docIds) ? [...new Set(body.docIds.filter((x): x is string => typeof x === "string"))].slice(0, MAX_ATTACH) : [];
  const message = typeof body?.message === "string" ? body.message.replace(/\s+/g, " ").trim() : "";
  if (message.length < 3) return json({ error: "Type a question (at least 3 characters)." }, 422);
  if (message.length > MAX_MESSAGE) return json({ error: `Questions can be at most ${MAX_MESSAGE} characters (yours is ${message.length}).` }, 422);
  if (!dbConfigured()) return json({ error: "Chat is not set up yet (no database)." }, 503);
  if (!aiConfigured("chat")) return json({ error: "Chat is not set up yet (no model key)." }, 503);
  const chatIdIn = body?.chatId === undefined || body?.chatId === null || body?.chatId === "" ? null : body.chatId;
  if (chatIdIn !== null && !isChatId(chatIdIn)) return json({ error: "That chat was not found." }, 404);

  // attached documents: only this browser's, and only ones that have been read
  if (docIds.length) {
    if (!vaultConfigured()) return json({ error: "The Vault is not set up on this server yet." }, 503);
    const found = await getDocs(bid, docIds).catch(() => null);
    if (!found || found.length !== docIds.length) return json({ error: "One of the attached documents was not found on this browser." }, 404);
    if (found.some((d) => d.status === "unreadable")) return json({ error: "One of the attached documents can't be read, so it can't be used." }, 422);
    if (found.some((d) => d.chunkCount === 0)) return json({ error: "One of the attached documents is still being read. Try again in a moment." }, 422);
  }
  // limits (per browser per day and week, all browsers per month)
  let verdict;
  try { verdict = evaluateLimits(await usageFor(bid), limits()); } catch { return json({ error: "Chat could not check its limits. Please try again." }, 503); }
  if (!verdict.allowed) { bump("limit_hit", `chat_${verdict.reason}`); return json({ error: verdict.message, reason: verdict.reason }, 429); }
  if (chatIdIn && !(await ownsChat(bid, chatIdIn).catch(() => false))) return json({ error: "That chat was not found." }, 404);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { /* client went away */ } };
      let chatId = chatIdIn as string | null, createdChat = false, userMsgId: number | null = null, counted = false, countId: number | null = null;
      const t0 = Date.now();
      /** The answer is saved: tell the browser its id (the thumbs up/down hangs on it) and count the question and how long it took, once. */
      const finish = (messageId: number) => { bump("chat_asked"); bump("answer_time", "chat", Date.now() - t0); send({ type: "done", messageId }); controller.close(); };
      const rollback = async () => {
        try { if (createdChat && chatId) await deleteChat(bid, chatId); else if (userMsgId !== null) await deleteMessage(userMsgId); if (counted) await uncountQuestion(bid, countId); } catch { /* best effort */ }
      };
      try {
        countId = await countQuestion(bid); counted = true;
        const history = chatId ? await recentTurns(chatId) : [];
        if (!chatId) { chatId = await createChat(bid, chatTitle(message)); createdChat = true; }
        userMsgId = await addMessage(chatId, { role: "user", content: message });
        send({ type: "start", chatId });

        // 0. the attached documents (if any): their best passages for this question
        let docSrc: ChatSource[] = [];
        if (docIds.length) {
          const dr = await searchAttached(bid, docIds, message);
          docSrc = docChatSources(dr.passages);
          if (dr.docs.some((d) => d.embeddedCount < d.chunkCount) && dr.mode === "keywords") send({ type: "note", text: "Your document is still being prepared for meaning search, so it was searched by keywords only." });
          else if (dr.mode === "keywords") send({ type: "note", text: "Your document was searched by keywords because the meaning search was busy." });
        }
        // 1. query rewrite: one cheap call -> 2-3 search queries. Skipped, with a note, if the model is busy (it is also in the per-minute budget).
        const tune = tuningFlags(tuningConfig, process.env);   // quality switches under evaluation (src/config/chat-tuning.json)
        let extra: string[] = [];
        try { const rp = buildRewritePrompt({ question: message, history, docContext: docSrc[0]?.text, statutory: tune.statutoryRewrite }); extra = parseRewrite((await completeAi("queryRewrite", { system: rp.system, messages: rp.messages, json: true })).text, message); }
        catch { send({ type: "note", text: "Search help was skipped because the model is busy, so the sections found may be less complete." }); }
        // 2. retrieve for the question and each rewritten query, merged
        const ret0 = await retrieveSources(message, history, extra, undefined, undefined, { hybrid: tune.hybridSearch, currentLaw: tune.currentLaw });
        // one numbering for everything the model may cite: the user's document passages first, then the Act sections
        const ret = { ...ret0, sources: [...docSrc, ...ret0.sources.map((x) => ({ ...x, n: x.n + docSrc.length }))] };
        const cites = ret.sources.map(citationOf);
        send({ type: "sources", sources: cites, searchMode: ret.searchMode, queries: [message, ...extra].slice(0, 4), meaning: ret.meaning });
        { const mn = askNoticeFor(ret.meaning); if (mn) send({ type: "note", text: mn }); }   // some searches fell back to exact words (already logged and counted): say so
        // sections the question names that the library does not hold (or holds only as scrambled text): say so plainly, link the Act on India Code, never answer from memory, and log it for the next downloads
        const absent: AbsentNote[] = uniqueGaps(ret.gaps).map((g) => gapNotice(g, g.url)), lead = gapLead(ret.gaps), logIt = docIds.length === 0;   // nothing is logged for a question that had a Vault document attached
        if (logIt) for (const g of ret.gaps.filter((x) => x.kind !== "nosuch")) logGap({ kind: g.kind === "unreliable" ? "unreliable_section" : "missing_section", question: message, act: g.actTitle, section: g.number, actId: g.actId });
        const logNotFound = () => { if (logIt && !ret.gaps.some((x) => x.kind !== "nosuch")) { const l = extractLookups(message)[0]; logGap({ kind: "not_found", question: message, act: l ? l.replace(/^\S+\s+/, "") : null, section: l ? l.split(" ")[0] : null }); } };
        if (!ret.sources.length) {
          const text = lead ? lead : "I couldn't find any sections in the Acts I searched that relate to this question. This tool searches Indian Central and State Acts and short excerpts of Supreme Court judgments; High Court and tribunal decisions are not included yet. Try describing the situation in other words, or name the Act and section.";
          send({ type: "delta", text });
          logNotFound();
          const check: CheckResult = { label: "not_found", unsupported: [], ...(absent.length ? { absent } : {}) };
          send({ type: "check", ...check });
          finish(await addMessage(chatId, { role: "assistant", content: text, citations: [], check, model: null })); return;
        }

        // 3. the answer, streamed. If the model fails AFTER some text, the partial answer is kept and marked as cut off.
        // sections the question itself names that the library holds (a State's copy included, when the question names the State): the answer says so, never "not found"
        const held = ret.sources.filter((x) => ret.namedKeys.includes(`${x.actId}|${x.sectionKey}`)).map((x) => ({ n: x.n, number: x.number ?? "", actTitle: x.actTitle, state: x.category === "central" ? null : x.state }));
        const prompt = buildChatPrompt({ question: message, history, sources: ret.sources, answerRules: tune.currentLaw, gaps: ret.gaps, held });
        let answer = lead ? `${lead}\n\n` : "", model = aiModelFor("chat"), cutOff = false;
        if (lead) send({ type: "delta", text: answer });
        try {
          for await (const ev of streamAi("chat", { system: prompt.system, messages: prompt.messages })) {
            if (ev.type === "text") { answer += ev.text; send({ type: "delta", text: ev.text }); } else if (ev.type === "done") model = ev.model;
          }
        } catch (e) { if (answer.trim() === lead.trim()) throw e; cutOff = true; }
        if (answer.trim() === lead.trim()) throw new AiError("unavailable", "The model returned no answer.");
        // The opening sentence is ours (gaps.mjs), not the model's: citation shaping touches only what the model wrote, so no chip is ever attached to the opening sentence ("Section 34 of the Indian Penal Code isn't in our library yet. [1]")
        const modelPart = (lead ? answer.slice(answer.indexOf(lead) + lead.length) : answer).trim();
        const aligned = alignCitations(ensureCitations(modelPart, ret.sources), ret.sources);
        const clean = sanitizeCitations(tune.citationCheck ? verifyCitations(aligned, ret.sources).text : aligned, ret.sources.length);
        // shaping that needs no model: the answer first, "Related provisions" only if they apply (switch currentLaw), a citation shown once per sentence (switch citationCheck)
        if (tune.currentLaw) clean.text = relatedOnlyIfApplicable(answerFirst(clean.text), ret.sources.map((x) => ({ n: x.n, number: x.number, heading: x.heading, text: x.text })), expandQuery(message, synonyms.rules).text);
        if (tune.citationCheck) clean.text = dedupeCitations(clean.text);
        clean.text = dropNotFoundClaims(tidyChips(clean.text), lead ? [] : held);   // a held section is never reported as not found (with a missing-section opening there is nothing held to claim)   // a chip on a line of its own belongs to the sentence before it
        clean.text = dropGapRepeats(lead ? `${lead}\n\n${fixIndiaCodeLinks(clean.text)}` : fixIndiaCodeLinks(clean.text), ret.gaps).trim();   // the opening sentence says a section is not held, once: the model must not say it again   // the model may write the old India Code address (India Code's old site), which no longer opens
        const onlyLead = !!lead && clean.text === lead.trim();   // nothing but "this section isn't in our library": one sentence, one link, one label
        if (clean.text !== answer.trim()) send({ type: "replace", text: clean.text });
        if (onlyLead && !cutOff) {
          send({ type: "sources", sources: [] });   // the sections found along the way are not part of this answer
          const check: CheckResult = { label: "not_found", unsupported: [], absent };
          logNotFound(); send({ type: "check", ...check });
          finish(await addMessage(chatId, { role: "assistant", content: clean.text, citations: [], check, model })); return;
        }
        if (cutOff) {
          const check: CheckResult = { label: "check", unsupported: [], cutOff: true, ...(absent.length ? { absent } : {}) };
          send({ type: "cutoff" });
          finish(await addMessage(chatId, { role: "assistant", content: clean.text, citations: cites, check, model })); return;
        }

        // 4. answer check: a second, cheap call. "Not found" answers need no call. If the check fails the answer is labelled "Check sources", never left unlabelled.
        // "Section N of <Act>" in the answer that is none of the sources found: if the library does not hold it, say so with a link (the model must not be the source of it)
        for (const m of unretrievedMentions(clean.text, ret.sources)) {
          const r = await searchSections(`${m.number} ${m.act}`, 1, 3).catch(() => null);
          if (r && r.available && r.mode === "lookup" && r.missing) { const g = { kind: "mentioned" as const, number: r.missing.number, actTitle: r.missing.actTitle }; if (absent.some((a) => gapKey({ ...g, actTitle: a.actTitle ?? "", number: g.number }) === gapKey(g))) continue; absent.push(gapNotice(g, officialSourceUrl(r.missing.sourceUrl, r.missing.actTitle))); if (logIt) logGap({ kind: "missing_section", question: message, act: g.actTitle, section: g.number, actId: r.missing.actId }); }
        }
        let check: CheckResult;
        if (!held.length && detectNotFound(clean.text)) { check = { label: "not_found", unsupported: [] }; logNotFound(); }
        else {
          try {
            const cp = buildCheckPrompt({ question: message, answer: clean.text, sources: ret.sources });
            const raw = await completeAi("answerCheck", { system: cp.system, messages: cp.messages, json: true });
            const p = parseCheck(raw.text);
            check = { label: p.label, unsupported: p.unsupported, missing: p.missing, ...(p.unreadable ? { unavailable: true } : {}) };
          } catch { check = { label: "check", unsupported: [], unavailable: true }; }
        }
        if (absent.length) check = { ...check, absent };
        // an answer that states law but cites no source cannot be "Supported"
        if ((check.label === "supported" || check.label === "partial") && citedNumbers(clean.text).length === 0) check = { label: "check", unsupported: check.unsupported, missing: [...(check.missing ?? []), "The answer does not cite any source."] };
        send({ type: "check", ...check });
        finish(await addMessage(chatId, { role: "assistant", content: clean.text, citations: cites, check, model }));
      } catch (e) {
        await rollback();
        const ai = e instanceof AiError ? e : null;
        const busy = ai && (ai.kind === "rate_limit" || ai.kind === "unavailable" || ai.kind === "timeout");
        if (busy) bump("model_busy", "chat");
        send({ type: "error", code: busy ? "busy" : ai?.kind === "blocked" ? "blocked" : "failed",
          message: busy ? "Busy, try again in a minute." : ai?.kind === "blocked" ? "The model declined to answer this question. Try rewording it." : "Something went wrong and your question was not counted. Please try again." });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { ...noStore, "Content-Type": "application/x-ndjson; charset=utf-8", "X-Accel-Buffering": "no" } });
}
