import { creditStatus, resetGuardCache } from "./guard.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { parseModelSpec, resolveTask, providerConfigured, AiError } from "./models.mjs";
import { sseEvents } from "./sse.mjs";
import { streamTask, completeTask } from "./run.mjs";
import config from "../../config/ai-models.json" with { type: "json" };

const sseBody = (chunks) => new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); } });
const okResponse = (chunks) => ({ ok: true, status: 200, body: sseBody(chunks), text: async () => "" });
const errResponse = (status, text = "") => ({ ok: false, status, body: null, text: async () => text });
const calls = [];
const fakeFetch = (...responses) => async (url, init) => { calls.push({ url: String(url), init }); const r = responses.shift(); if (r instanceof Error) throw r; return r; };
const gem = (o) => `data: ${JSON.stringify(o)}\n\n`;
const KEY = "AIza-test-secret-key";
const env = { GEMINI_API_KEY: KEY };
const solo = { tasks: { chat: { model: "gemini:gemini-3.5-flash-lite", thinking: "off", temperature: 0.2, maxOutputTokens: 100, timeoutMs: 1000 } } };   // one model, no fallback

test("parseModelSpec accepts provider:model and rejects the rest", () => {
  assert.deepEqual(parseModelSpec("gemini:gemini-3.5-flash-lite"), { provider: "gemini", model: "gemini-3.5-flash-lite" });
  assert.deepEqual(parseModelSpec("anthropic:claude-haiku-5-5"), { provider: "anthropic", model: "claude-haiku-5-5" });
  for (const bad of ["", "gemini", "mistral:large", ":x", undefined]) assert.throws(() => parseModelSpec(bad));
});
test("the shipped config defines every task and parses", () => {
  for (const t of ["chat", "answerCheck", "queryRewrite", "drafting", "review", "rerun"]) { const r = resolveTask(t, config, {}); assert.ok(r.primary.model); assert.ok(r.maxOutputTokens > 0); }
});
test("switching a task to Claude is an env/config change only", () => {
  assert.equal(resolveTask("chat", config, {}).primary.provider, "openrouter"); assert.equal(resolveTask("review", config, {}).primary.provider, "gemini");   // review and drafting stay on free Gemini until credit is bought
  for (const t of ["chat", "answerCheck", "queryRewrite", "templatePick"]) assert.ok(resolveTask(t, config, {}).fallbacks.every((f) => f.provider === "gemini") && resolveTask(t, config, {}).fallbacks.length >= 1);
  assert.deepEqual(resolveTask("chat", config, { AI_MODEL_CHAT: "anthropic:claude-haiku-5-5" }).primary, { provider: "anthropic", model: "claude-haiku-5-5" });
  assert.deepEqual(resolveTask("answerCheck", config, { AI_MODEL_ANSWER_CHECK: "anthropic:claude-haiku-5-5" }).primary.provider, "anthropic");
  assert.deepEqual(resolveTask("drafting", config, { AI_MODEL_DRAFTING: "litellm:claude-sonnet-5-5" }).primary, { provider: "litellm", model: "claude-sonnet-5-5" });
  assert.throws(() => resolveTask("nope", config, {}));
});
test("providerConfigured needs the right key (litellm also a base url)", () => {
  assert.equal(providerConfigured("gemini", {}), false); assert.equal(providerConfigured("gemini", env), true);
  assert.equal(providerConfigured("litellm", { LITELLM_API_KEY: "k" }), false); assert.equal(providerConfigured("litellm", { LITELLM_API_KEY: "k", LITELLM_BASE_URL: "http://x" }), true);
});
test("sseEvents reassembles events split across chunks and ignores comments", async () => {
  const out = []; for await (const e of sseEvents(sseBody(["data: {\"a\"", ":1}\n\nevent: x\nda", "ta: two\n\n: hi\n\ndata: last"]))) out.push(e);
  assert.deepEqual(out, [{ event: "message", data: '{"a":1}' }, { event: "x", data: "two" }, { event: "message", data: "last" }]);
});
test("gemini stream: text parts in order, thought parts hidden, usage, key only in the header, thinking set for gemini-3", async () => {
  calls.length = 0;
  const f = fakeFetch(okResponse([gem({ candidates: [{ content: { parts: [{ text: "hidden", thought: true }, { text: "Hello " }] } }] }), gem({ candidates: [{ content: { parts: [{ text: "world" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4, thoughtsTokenCount: 2 } })]));
  const r = await completeTask("chat", { system: "sys", messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yo" }, { role: "user", content: "q" }] }, { config: solo, env, fetchImpl: f });
  assert.equal(r.text, "Hello world"); assert.deepEqual(r.usage, { inputTokens: 10, outputTokens: 6 }); assert.equal(r.model, "gemini:gemini-3.5-flash-lite");
  const c = calls[0]; assert.ok(!c.url.includes(KEY)); assert.equal(c.init.headers["x-goog-api-key"], KEY); assert.ok(c.url.includes("models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse"));
  const body = JSON.parse(c.init.body); assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "minimal"); assert.deepEqual(body.contents.map((m) => m.role), ["user", "model", "user"]); assert.equal(body.systemInstruction.parts[0].text, "sys");
});
test("gemini 2.5 uses a thinking budget of 0 when thinking is off", async () => {
  calls.length = 0;
  const cfg = { tasks: { chat: { model: "gemini:gemini-2.5-flash", thinking: "off" } } };
  await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: fakeFetch(okResponse([gem({ candidates: [{ content: { parts: [{ text: "x" }] } }] })])) });
  assert.equal(JSON.parse(calls[0].init.body).generationConfig.thinkingConfig.thinkingBudget, 0);
});
test("gemini 429 becomes rate_limit with the retry delay, and the key is never in the error", async () => {
  const f = fakeFetch(errResponse(429, `{"error":{"message":"quota exceeded for key ${KEY}. Please retry in 31.2s","details":[{"retryDelay":"31s"}]}}`));
  await assert.rejects(() => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: solo, env, fetchImpl: f }), (e) => { assert.ok(e instanceof AiError); assert.equal(e.kind, "rate_limit"); assert.equal(e.retryAfterSec, 32); assert.ok(!JSON.stringify(e.detail).includes(KEY)); assert.ok(!e.message.includes(KEY)); return true; });
});
test("errors map to kinds: 503 unavailable, 400 key invalid is auth, network failure unavailable, abort timeout", async () => {
  const run = (r) => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: solo, env, fetchImpl: fakeFetch(r) });
  await assert.rejects(() => run(errResponse(503, "overloaded")), { kind: "unavailable" });
  await assert.rejects(() => run(errResponse(400, "API key not valid. Please pass a valid API key.")), { kind: "auth" });
  await assert.rejects(() => run(new TypeError("fetch failed")), { kind: "unavailable" });
  const to = new Error("t"); to.name = "TimeoutError"; await assert.rejects(() => run(to), { kind: "timeout" });
});
test("a blocked prompt is reported as blocked", async () => {
  await assert.rejects(() => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: solo, env, fetchImpl: fakeFetch(okResponse([gem({ promptFeedback: { blockReason: "SAFETY" } })])) }), { kind: "blocked" });
});
test("anthropic stream parses text deltas and usage (config-only switch)", async () => {
  calls.length = 0;
  const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
  const f = fakeFetch(okResponse([ev({ type: "message_start", message: { usage: { input_tokens: 12 } } }), ev({ type: "content_block_delta", delta: { type: "text_delta", text: "Sec" } }), ev({ type: "content_block_delta", delta: { type: "text_delta", text: "tion 138" } }), ev({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } })]));
  const r = await completeTask("chat", { system: "s", messages: [{ role: "user", content: "q" }] }, { config, env: { ...env, ANTHROPIC_API_KEY: "sk-ant-x", AI_MODEL_CHAT: "anthropic:claude-haiku-5-5" }, fetchImpl: f });
  assert.equal(r.text, "Section 138"); assert.deepEqual(r.usage, { inputTokens: 12, outputTokens: 5 }); assert.equal(r.model, "anthropic:claude-haiku-5-5");
  assert.equal(calls[0].url, "https://api.anthropic.com/v1/messages"); assert.equal(calls[0].init.headers["x-api-key"], "sk-ant-x"); assert.equal(JSON.parse(calls[0].init.body).model, "claude-haiku-5-5");
});
test("litellm / OpenAI-compatible stream parses deltas, [DONE] and usage", async () => {
  calls.length = 0;
  const d = (o) => `data: ${JSON.stringify(o)}\n\n`;
  const f = fakeFetch(okResponse([d({ choices: [{ delta: { content: "A" } }] }), d({ choices: [{ delta: { content: "B" }, finish_reason: "stop" }] }), d({ choices: [], usage: { prompt_tokens: 7, completion_tokens: 2 } }), "data: [DONE]\n\n"]));
  const r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config, env: { LITELLM_API_KEY: "k", LITELLM_BASE_URL: "http://localhost:4000/v1/", AI_MODEL_CHAT: "litellm:claude-haiku-5-5" }, fetchImpl: f });
  assert.equal(r.text, "AB"); assert.deepEqual(r.usage, { inputTokens: 7, outputTokens: 2 }); assert.equal(calls[0].url, "http://localhost:4000/v1/chat/completions");
});
test("openai: direct endpoint, bearer key, reasoning models use max_completion_tokens and no temperature, others the reverse; key never in an error", async () => {
  calls.length = 0;
  const d = (o) => `data: ${JSON.stringify(o)}\n\n`, body = () => [d({ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }), d({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 1 } }), "data: [DONE]\n\n"];
  const run = (model, extra = {}) => completeTask("chat", { system: "s", messages: [{ role: "user", content: "q" }] }, { config, env: { OPENAI_API_KEY: "sk-test", AI_MODEL_CHAT: `openai:${model}`, ...extra }, fetchImpl: fakeFetch(okResponse(body())) });
  const r = await run("gpt-4.1-mini");
  assert.equal(r.text, "ok"); assert.equal(r.model, "openai:gpt-4.1-mini"); assert.deepEqual(r.usage, { inputTokens: 3, outputTokens: 1 });
  assert.equal(calls[0].url, "https://api.openai.com/v1/chat/completions"); assert.equal(calls[0].init.headers.Authorization, "Bearer sk-test");
  let b = JSON.parse(calls[0].init.body); assert.ok(b.max_tokens && "temperature" in b && !b.max_completion_tokens); assert.equal(b.messages[0].role, "system");
  await run("gpt-5-mini"); b = JSON.parse(calls[1].init.body); assert.ok(b.max_completion_tokens && !("temperature" in b) && b.reasoning_effort === "minimal"); assert.equal(b.messages[0].role, "developer");
  assert.equal(providerConfigured("openai", {}), false); assert.equal(providerConfigured("openai", { OPENAI_API_KEY: "k" }), true);
  await assert.rejects(completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: { tasks: { chat: { model: "openai:x" } } }, env: { OPENAI_API_KEY: "sk-secret-123" }, fetchImpl: fakeFetch(errResponse(400, "bad key sk-secret-123 here")) }), (e) => e.kind === "bad_request" && !JSON.stringify(e.detail).includes("sk-secret-123"));
});
test("openrouter: base URL, key name and headers come from config; prefixed model names; cost passed through", async () => {
  calls.length = 0;
  const d = (o) => `data: ${JSON.stringify(o)}\n\n`;
  const cfg = { providers: { openrouter: { baseUrl: "https://example.test/api/v1/", keyEnv: "MY_OR_KEY", headers: { "HTTP-Referer": "https://app.lexbharat.ai", "X-Title": "LexBharat" } } }, tasks: { chat: { model: "openrouter:anthropic/claude-haiku-5.5", maxOutputTokens: 50 } } };
  const r = await completeTask("chat", { system: "s", messages: [{ role: "user", content: "q" }] }, { config: cfg, env: { MY_OR_KEY: "sk-or-x" }, fetchImpl: fakeFetch(okResponse([d({ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }), d({ choices: [], usage: { prompt_tokens: 4, completion_tokens: 2, cost: 0.0001 } }), "data: [DONE]\n\n"])) });
  assert.equal(r.text, "hi"); assert.equal(r.model, "openrouter:anthropic/claude-haiku-5.5"); assert.equal(r.usage.cost, 0.0001);
  assert.equal(calls[0].url, "https://example.test/api/v1/chat/completions"); const h = calls[0].init.headers;
  assert.equal(h.Authorization, "Bearer sk-or-x"); assert.equal(h["HTTP-Referer"], "https://app.lexbharat.ai"); assert.equal(h["X-Title"], "LexBharat");
  const b = JSON.parse(calls[0].init.body); assert.equal(b.model, "anthropic/claude-haiku-5.5"); assert.ok(b.max_tokens && "temperature" in b);
  assert.equal((await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env: {}, fetchImpl: fakeFetch() }).catch((e) => e)).kind, "not_configured");
  assert.equal(providerConfigured("openrouter", { OPENROUTER_API_KEY: "k" }), true);
  assert.equal(parseModelSpec("openrouter:openai/gpt-4.1-mini:free").model, "openai/gpt-4.1-mini:free");
});
test("fallback: a busy first model before any text moves to the next; an error after text is thrown; an unset provider is skipped", async () => {
  const cfg = { tasks: { chat: { model: "gemini:a", fallback: ["gemini:b"] } } };
  const r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: fakeFetch(errResponse(429, "busy"), okResponse([gem({ candidates: [{ content: { parts: [{ text: "from b" }] } }] })])) });
  assert.equal(r.text, "from b"); assert.equal(r.model, "gemini:b");
  const broken = okResponse([gem({ candidates: [{ content: { parts: [{ text: "partial" }] } }] }), 'data: {"error":{"code":503,"message":"x"}}\n\n']);
  const got = []; await assert.rejects(async () => { for await (const e of streamTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: fakeFetch(broken) })) got.push(e); }, { kind: "unavailable" });
  assert.equal(got[0].text, "partial");
  const cfg2 = { tasks: { chat: { model: "anthropic:x", fallback: ["gemini:b"] } } };
  assert.equal((await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg2, env, fetchImpl: fakeFetch(okResponse([gem({ candidates: [{ content: { parts: [{ text: "ok" }] } }] })])) })).model, "gemini:b");
  await assert.rejects(() => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config, env: {}, fetchImpl: fakeFetch() }), { kind: "not_configured" });
});
test("AI_FALLBACK_<TASK> replaces or removes the configured fallbacks", () => {
  assert.equal(resolveTask("chat", config, {}).fallbacks.length, 2);
  assert.deepEqual(resolveTask("chat", config, { AI_FALLBACK_CHAT: "" }).fallbacks, []);
  assert.deepEqual(resolveTask("chat", config, { AI_FALLBACK_CHAT: "anthropic:claude-haiku-5-5, gemini:x" }).fallbacks, [{ provider: "anthropic", model: "claude-haiku-5-5" }, { provider: "gemini", model: "x" }]);
  assert.deepEqual(resolveTask("answerCheck", config, { AI_FALLBACK_ANSWER_CHECK: "" }).fallbacks, []);
});
test("a model that is silent past firstTokenMs is abandoned and the fallback answers; one that has started is not cut off by that deadline", async () => {
  const cfg = { tasks: { chat: { model: "gemini:slow", fallback: ["gemini:fast"], firstTokenMs: 50, timeoutMs: 5000 } } };
  const f = async (url, init) => {
    if (String(url).includes("models/slow")) return new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    return okResponse([gem({ candidates: [{ content: { parts: [{ text: "quick answer" }] } }] })]);
  };
  const t0 = Date.now(), r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: f });
  assert.equal(r.text, "quick answer"); assert.equal(r.model, "gemini:fast"); assert.ok(Date.now() - t0 < 2000);
  // started streaming, then slow: the first-token deadline must not apply any more
  const slowTail = { ok: true, status: 200, text: async () => "", body: new ReadableStream({ async start(c) { c.enqueue(new TextEncoder().encode(gem({ candidates: [{ content: { parts: [{ text: "first " }] } }] }))); await new Promise((x) => setTimeout(x, 120)); c.enqueue(new TextEncoder().encode(gem({ candidates: [{ content: { parts: [{ text: "second" }] } }] }))); c.close(); } }) };
  assert.equal((await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: { tasks: { chat: { model: "gemini:a", firstTokenMs: 50, timeoutMs: 5000 } } }, env, fetchImpl: fakeFetch(slowTail) })).text, "first second");
});
test("the first-token deadline is not applied to the last model in the chain", async () => {
  const cfg = { tasks: { chat: { model: "gemini:only", firstTokenMs: 30, timeoutMs: 5000 } } };
  const late = { ok: true, status: 200, text: async () => "", body: new ReadableStream({ async start(c) { await new Promise((x) => setTimeout(x, 120)); c.enqueue(new TextEncoder().encode(gem({ candidates: [{ content: { parts: [{ text: "late but fine" }] } }] }))); c.close(); } }) };
  assert.equal((await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: fakeFetch(late) })).text, "late but fine");
});

test("files are sent to Gemini as inline data, to Anthropic as document/image blocks, and the message text still goes along", async () => {
  const bodies = [];
  const fetchImpl = async (url, init) => { bodies.push({ url: String(url), body: JSON.parse(init.body) }); return new Response('data: {"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}]}\n\ndata: {"type":"message_stop"}\n\n', { status: 200, headers: { "content-type": "text/event-stream" } }); };
  const config = { tasks: { ocr: { model: "gemini:gemini-3.5-flash-lite" }, ocrA: { model: "anthropic:claude-haiku-5-5" } } };
  const files = [{ mime: "application/pdf", data: "QUJD" }, { mime: "image/png", data: "REVG" }];
  await completeTask("ocr", { messages: [{ role: "user", content: "read", files }] }, { config, env: { GEMINI_API_KEY: "k" }, fetchImpl });
  const g = bodies[0].body.contents[0].parts;
  assert.deepEqual(g.slice(0, 2), [{ inlineData: { mimeType: "application/pdf", data: "QUJD" } }, { inlineData: { mimeType: "image/png", data: "REVG" } }]); assert.deepEqual(g[2], { text: "read" });
  try { await completeTask("ocrA", { messages: [{ role: "user", content: "read", files }] }, { config, env: { ANTHROPIC_API_KEY: "k" }, fetchImpl }); } catch { /* the fake reply is Gemini-shaped; only the request matters */ }
  const a = bodies[1].body.messages[0].content;
  assert.equal(a[0].type, "document"); assert.equal(a[0].source.media_type, "application/pdf"); assert.equal(a[1].type, "image"); assert.deepEqual(a[2], { type: "text", text: "read" });
});

const say = (t) => okResponse([gem({ candidates: [{ content: { parts: [{ text: t }] } }] })]);
const modelOf = (c) => /models\/([^:]+):/.exec(c.url)[1];
const withRetry = { retry: { unavailable: { times: 1, waitMs: 5 } }, tasks: { chat: { model: "gemini:a", fallback: ["gemini:b"] } } };
test("a 503 is asked again once on the same model (after the configured wait) before the fallback is used", async () => {
  calls.length = 0;
  const r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: withRetry, env, fetchImpl: fakeFetch(errResponse(503, "overloaded"), say("fine")) });
  assert.equal(r.text, "fine"); assert.equal(r.model, "gemini:a"); assert.deepEqual(calls.map(modelOf), ["a", "a"]);
  calls.length = 0;
  const r2 = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: withRetry, env, fetchImpl: fakeFetch(errResponse(503), errResponse(503), say("from b")) });
  assert.equal(r2.model, "gemini:b"); assert.deepEqual(calls.map(modelOf), ["a", "a", "b"]);
  calls.length = 0;
  await assert.rejects(() => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: withRetry, env, fetchImpl: fakeFetch(errResponse(503), errResponse(503), errResponse(503), errResponse(503)) }), { kind: "unavailable" });
  assert.deepEqual(calls.map(modelOf), ["a", "a", "b", "b"]);   // each model gets one more try; then the real error is shown
});
test("a rate limit or a rejected key does not wait: rate limit goes straight to the fallback, an auth error stops", async () => {
  calls.length = 0;
  const r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: withRetry, env, fetchImpl: fakeFetch(errResponse(429, "busy"), say("b")) });
  assert.equal(r.model, "gemini:b"); assert.deepEqual(calls.map(modelOf), ["a", "b"]);
});
test("the shipped config asks again once after 5 seconds, and a task can turn that off", () => {
  assert.deepEqual(resolveTask("chat", config, {}).retryUnavailable, { times: 1, waitMs: 5000 });
  assert.deepEqual(resolveTask("chat", { ...config, tasks: { chat: { ...config.tasks.chat, retryUnavailable: { times: 0 } } } }, {}).retryUnavailable, { times: 0, waitMs: 0 });
  assert.deepEqual(resolveTask("chat", solo, {}).retryUnavailable, { times: 0, waitMs: 0 });
});

test("chat waits 30 s for the first answer and has a total time budget inside the host's 60 s limit", () => {
  const t = resolveTask("chat", config, {}); assert.equal(t.firstTokenMs, 30000); assert.ok(t.budgetMs > 0 && t.budgetMs < 60000); assert.ok(t.timeoutMs >= t.firstTokenMs);
  assert.equal(resolveTask("review", config, {}).budgetMs, 0);   // tasks without a budget are unchanged
  assert.equal(config.ui.slowNoticeMs, 10000); assert.match(config.ui.slowNoticeText, /Still thinking/);
});
test("when the time budget is used up no further attempt is made and the real error is reported", async () => {
  calls.length = 0;
  const cfg = { retry: { unavailable: { times: 1, waitMs: 200 } }, tasks: { chat: { model: "gemini:a", fallback: ["gemini:b"], budgetMs: 2100 } } };
  await assert.rejects(() => completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: cfg, env, fetchImpl: fakeFetch(errResponse(503), errResponse(503), say("b")) }), { kind: "unavailable" });
  assert.deepEqual(calls.map(modelOf), ["a"]);   // the wait before the retry left under 2 s of budget, so neither the retry nor the fallback ran
  calls.length = 0;
  const r = await completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: { tasks: { chat: { model: "gemini:a", fallback: ["gemini:b"], budgetMs: 50000 } } }, env, fetchImpl: fakeFetch(errResponse(429), say("fine")) });
  assert.equal(r.model, "gemini:b");   // with budget left, a rate-limited model falls back at once
});

test("spend guard: below the minimum credit the paid model is skipped and the free fallback answers; at or above it, and when unreadable, the paid model is used", async () => {
  const cfg = (extra = {}) => ({ spendGuard: { provider: "openrouter", minRemainingUsd: 0.25, cacheMs: 60000 }, providers: { openrouter: { baseUrl: "https://example.test/api/v1", keyEnv: "OR" } }, tasks: { chat: { model: "openrouter:google/x", fallback: ["gemini:g"], ...extra } } });
  const keyResp = (remaining) => ({ ok: true, status: 200, json: async () => ({ data: { limit: 2, limit_remaining: remaining } }) });
  const d = (o) => `data: ${JSON.stringify(o)}\n\n`, orBody = () => okResponse([d({ choices: [{ delta: { content: "paid" }, finish_reason: "stop" }] }), "data: [DONE]\n\n"]);
  const gemBody = () => okResponse([gem({ candidates: [{ content: { parts: [{ text: "free" }] } }] })]);
  const e = { OR: "k", GEMINI_API_KEY: "g" };
  const ask = (remaining, c = cfg()) => { resetGuardCache(); return completeTask("chat", { messages: [{ role: "user", content: "q" }] }, { config: c, env: e, fetchImpl: async (url, init) => (String(url).endsWith("/key") ? (remaining === "down" ? { ok: false, status: 500, json: async () => ({}) } : keyResp(remaining)) : (String(url).includes("openrouter") || String(url).includes("example.test") ? orBody() : gemBody())) }); };
  assert.equal((await ask(0.2)).text, "free");
  assert.equal((await ask(0.26)).text, "paid");
  assert.equal((await ask("down")).text, "paid");
  resetGuardCache(); const c = await creditStatus({ config: cfg(), env: e, fetchImpl: async () => keyResp(0.1) });
  assert.equal(c.tripped, true); assert.equal(c.remaining, 0.1);
});

// ---- what the reader is told when an AI call fails: the real cause, from one place (notice.mjs) ----
import { aiFailure, aiReason } from "./notice.mjs";
import fsNotice from "node:fs";
test("a failed AI call names its cause: limit reached, busy, or not set up", () => {
  const mk = (kind) => new AiError(kind, "x");
  assert.equal(aiFailure(mk("rate_limit"), { counted: "question" }).code, "limit");
  assert.match(aiFailure(mk("rate_limit"), { counted: "question" }).message, /request limit.*not counted/);
  assert.equal(aiFailure(mk("unavailable")).code, "busy");
  assert.match(aiFailure(mk("timeout")).message, /took too long/);
  assert.equal(aiFailure(mk("auth")).code, "not_set_up");
  assert.equal(aiFailure(mk("not_configured")).family, "not_set_up");
  assert.equal(aiFailure(mk("blocked")).code, "blocked");
  assert.equal(aiFailure(new Error("boom")).code, "failed");
  assert.equal(aiFailure(mk("rate_limit")).busy && aiFailure(mk("auth")).busy, false);
  assert.equal(aiReason(mk("rate_limit")), "the AI model has reached its request limit");
});
test("class: no route writes its own 'busy' sentence; they all use aiFailure / the meaning notices", () => {
  const walk = (d) => fsNotice.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const bad = walk("src").filter((f) => /\.(ts|tsx)$/.test(f)).filter((f) => /Busy, try again|meaning search was busy|model is busy, so/.test(fsNotice.readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
test("a model's text never carries the old India Code address; the OCR of a user's scan is left alone", async () => {
  const body = "See https://www.indiacode.nic.in/handle/123456789/20062?view_type=browse and indiacode.nic.in for the text.";
  const run = (task) => completeTask(task, { messages: [{ role: "user", content: "q" }] }, { config: { tasks: { [task]: solo.tasks.chat } }, env, fetchImpl: fakeFetch(okResponse([gem({ candidates: [{ content: { parts: [{ text: body }] } }] })])) });
  for (const task of ["chat", "drafting", "review"]) { const r = await run(task); assert.ok(!/indiacode\.nic\.in/.test(r.text), task); assert.match(r.text, /indiacode\.gov\.in/); }
  assert.match((await run("ocr")).text, /indiacode\.nic\.in/);
});
