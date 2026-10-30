#!/bin/sh
# Local server for the evaluation: free Gemini only (no OpenRouter credit), no fallback hiding failures, high chat limits, usage counters (Supabase) switched off, Voyage vectors cached on disk and spaced out for the free 3-requests-a-minute account.
export ACCESS_PASSWORD=throwaway-local-test-9
export AI_MODEL_CHAT=gemini:gemini-3.5-flash-lite AI_MODEL_ANSWER_CHECK=gemini:gemini-3.5-flash-lite AI_MODEL_QUERY_REWRITE=gemini:gemini-3.5-flash-lite
export AI_FALLBACK_CHAT= AI_FALLBACK_ANSWER_CHECK= AI_FALLBACK_QUERY_REWRITE=
export CHAT_LIMIT_DAILY=100000 CHAT_LIMIT_WEEKLY=100000 CHAT_LIMIT_MONTHLY_GLOBAL=100000
export SUPABASE_URL= SUPABASE_SECRET_KEY=
export EMBED_CACHE_FILE=docs/eval/.cache/embed.json EMBED_MIN_INTERVAL_MS=21000
# Evaluation runs use ONLY an evaluation key: EVAL_GEMINI_API_KEY_2 first, then EVAL_GEMINI_API_KEY (both in .env.local). Never the live GEMINI_API_KEY: the live site depends on its quota. Never printed.
key() { grep "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"' "; }
EK=$(key EVAL_GEMINI_API_KEY_2); [ -z "$EK" ] && EK=$(key EVAL_GEMINI_API_KEY); LK=$(key GEMINI_API_KEY)
if [ -z "$EK" ] || [ "$EK" = "$LK" ]; then echo "No evaluation Gemini key in .env.local (different from the live key): refusing to start." >&2; exit 1; fi
export GEMINI_API_KEY="$EK"
exec npx next dev --port 3100
