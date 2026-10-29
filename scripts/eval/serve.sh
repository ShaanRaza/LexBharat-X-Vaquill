#!/bin/sh
# Local server for the evaluation: free Gemini only (no OpenRouter credit), no fallback hiding failures, high chat limits, usage counters (Supabase) switched off, Voyage vectors cached on disk and spaced out for the free 3-requests-a-minute account.
export ACCESS_PASSWORD=throwaway-local-test-9
export AI_MODEL_CHAT=gemini:gemini-3.5-flash-lite AI_MODEL_ANSWER_CHECK=gemini:gemini-3.5-flash-lite AI_MODEL_QUERY_REWRITE=gemini:gemini-3.5-flash-lite
export AI_FALLBACK_CHAT= AI_FALLBACK_ANSWER_CHECK= AI_FALLBACK_QUERY_REWRITE=
export CHAT_LIMIT_DAILY=100000 CHAT_LIMIT_WEEKLY=100000 CHAT_LIMIT_MONTHLY_GLOBAL=100000
export SUPABASE_URL= SUPABASE_SECRET_KEY=
export EMBED_CACHE_FILE=docs/eval/.cache/embed.json EMBED_MIN_INTERVAL_MS=21000
exec npx next dev --port 3100
