#!/bin/sh
# Server for the UI sweep: throwaway password, no AI keys (Ask is stubbed by the sweep), usage counters and Vault storage (Supabase) switched off, so the sweep writes nothing anywhere and uses no model quota.
export ACCESS_PASSWORD=throwaway-local-test-9
export AI_MODEL_CHAT=gemini:none AI_FALLBACK_CHAT= AI_FALLBACK_ANSWER_CHECK= AI_FALLBACK_QUERY_REWRITE=
export GEMINI_API_KEY= OPENROUTER_API_KEY=
export SUPABASE_URL= SUPABASE_SECRET_KEY=
export EMBED_CACHE_FILE=docs/eval/.cache/embed.json EMBED_MIN_INTERVAL_MS=21000
export UI_SWEEP=1
export STATIC_DATA_BASE_URL=http://localhost:3300
exec npx next dev --port 3300
