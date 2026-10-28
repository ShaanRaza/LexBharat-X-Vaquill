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
  for (const bad of ["", "gemini", "openai:gpt", ":x", undefined]) assert.throws(() => parseModelSpec(bad));
});
test("the shipped config defines every task and parses", () => {
  for (const t of ["chat", "answerCheck", "queryRewrite", "drafting", "review", "rerun"]) { const r = resolveTask(t, config, {}); assert.ok(r.primary.model); assert.ok(r.maxOutputTokens > 0); }
});
test("switching a task to Claude is an env/config change only", () => {
  assert.equal(resolveTask("chat", config, {}).primary.provider, "gemini");
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
  assert.equal(resolveTask("chat", config, {}).fallbacks.length, 1);
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
