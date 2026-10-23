#!/usr/bin/env bash
# Loads Act section text into Neon Postgres for keyword search. Needs psql and DATABASE_URL (read from .env.local; it is never printed).
# usage: scripts/acts/load-neon.sh [TEXT_DIR=../lexbharat-data/acts-text] [--missing-only]
#   default: DESTRUCTIVE for acts / act_sections / act_missing_sections (drops and recreates them; search is unavailable while it runs, about 2 minutes).
#   --missing-only: only recreates act_missing_sections (needs acts to exist); the live search keeps working.
set -euo pipefail
cd "$(dirname "$0")/../.."
TEXT="${1:-../lexbharat-data/acts-text}"
MODE="${2:-}"
set +x
if [ -z "${DATABASE_URL:-}" ] && [ -f .env.local ]; then DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)"; fi
[ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set (put it in .env.local)." >&2; exit 1; }
[ -d "$TEXT" ] || { echo "Text folder not found: $TEXT (run scripts/acts/export-act-text.sh first)." >&2; exit 1; }
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
node scripts/acts/build-neon-csv.mjs "$TEXT" "$TMP"
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@" 2>&1 | sed -E 's#postgres(ql)?://[^ ]+#<redacted>#g'; return "${PIPESTATUS[0]}"; }
if [ "$MODE" = "--missing-only" ]; then
  run -f scripts/acts/neon-missing.sql
  run -c "\\copy act_missing_sections (act_id,number) FROM '$TMP/missing.csv' WITH (FORMAT csv)"
  run -At -c "select 'act_missing_sections rows', count(*), count(DISTINCT act_id) from act_missing_sections"
  exit 0
fi
run -f scripts/acts/neon-schema.sql
run -c "\\copy acts (act_id,title,year,category,state,act_status,source_url,section_count) FROM '$TMP/acts.csv' WITH (FORMAT csv)"
run -c "\\copy act_sections (act_id,section_key,ord,number,heading,chapter,status,flags,chunk_count,body) FROM '$TMP/sections.csv' WITH (FORMAT csv)"
run -f scripts/acts/neon-missing.sql
run -c "\\copy act_missing_sections (act_id,number) FROM '$TMP/missing.csv' WITH (FORMAT csv)"
run -f scripts/acts/neon-indexes.sql
node scripts/acts/fix-misfiled-central.mjs --apply   # re-applies the Central corrections (keeps raw_category = the dataset's value)
run -At -c "select 'acts', count(*) from acts union all select 'sections', count(*) from act_sections union all select 'sections with text', count(*) from act_sections where body is not null"
run -At -c "select 'database', pg_size_pretty(pg_database_size(current_database())) union all select 'act_sections table (heap+toast)', pg_size_pretty(pg_table_size('act_sections')) union all select 'gin index', pg_size_pretty(pg_relation_size('act_sections_tsv_gin')) union all select 'all indexes', pg_size_pretty(pg_indexes_size('act_sections')+pg_indexes_size('acts'))"
