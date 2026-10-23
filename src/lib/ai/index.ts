// The one entry point for model calls. Server-only. Picks the model per task from src/config/ai-models.json (+ AI_MODEL_<TASK> env), calls the provider, never exposes a key.
import config from "@/config/ai-models.json";
import { streamTask as _stream, completeTask as _complete } from "./run.mjs";
import { providerConfigured, resolveTask } from "./models.mjs";

export type AiTask = "chat" | "answerCheck" | "drafting" | "review" | "rerun";
export type AiInput = { system?: string; messages: { role: "user" | "assistant"; content: string }[]; temperature?: number; maxOutputTokens?: number; json?: boolean; timeoutMs?: number; signal?: AbortSignal };
export type AiEvent = { type: "text"; text: string } | { type: "done"; usage: { inputTokens: number; outputTokens: number }; model: string; finish?: string | null };
export { AiError } from "./models.mjs";

const ctx = () => ({ config, env: process.env as Record<string, string | undefined>, fetchImpl: fetch });
export const streamAi = (task: AiTask, input: AiInput): AsyncGenerator<AiEvent> => _stream(task, input, ctx()) as AsyncGenerator<AiEvent>;
export const completeAi = (task: AiTask, input: AiInput) => _complete(task, input, ctx()) as Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } | null; model: string | null }>;
/** True when the primary model's provider has its key set (so the UI can say "not set up" instead of failing). */
export const aiConfigured = (task: AiTask) => providerConfigured(resolveTask(task, config, process.env).primary.provider, process.env as Record<string, string | undefined>);
/** The model a task will use, as "provider:model" (for the footer note and tests; never includes a key). */
export const aiModelFor = (task: AiTask) => { const r = resolveTask(task, config, process.env); return `${r.primary.provider}:${r.primary.model}`; };
