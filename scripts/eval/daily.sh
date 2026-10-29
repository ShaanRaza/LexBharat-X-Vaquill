#!/bin/sh
# One daily evaluation run on the free Gemini quota (about 500 requests a day): the 5 main-set questions that lost points + 8 fixed control questions + the 28 hard questions (~41 questions).
# usage: scripts/eval/daily.sh <label> [ENV=1 ...]     e.g.  scripts/eval/daily.sh fix-b CHAT_TUNING_HYBRID_SEARCH=1 CHAT_TUNING_STATUTORY_REWRITE=1
# Starts its own server on port 3100 with those switches, runs both sets, stops the server. Writes docs/eval/runs/<label>-main.json and <label>-hard.json. Never edit src/ while this runs.
cd "$(dirname "$0")/../.." || exit 1
LABEL="$1"; shift
[ -z "$LABEL" ] && { echo "usage: scripts/eval/daily.sh <label> [ENV=1 ...]"; exit 1; }
for a in "$@"; do export "$a"; done
pkill -f "next dev --port 3100" 2>/dev/null; sleep 2
mkdir -p docs/eval/.cache
nohup scripts/eval/serve.sh > docs/eval/.cache/server.log 2>&1 &
i=0; until curl -s -o /dev/null -m 5 http://localhost:3100/api/access/login -X POST -H 'content-type: application/json' -d '{"password":"x"}'; do i=$((i+1)); [ $i -gt 60 ] && { echo "server did not start"; exit 1; }; sleep 3; done
MAIN="10,19,22,41,51,1,7,12,18,25,30,35,45"
node scripts/eval/e2e.mjs "$LABEL-main" --only "$MAIN" > "docs/eval/.cache/$LABEL-main.log" 2>&1
node scripts/eval/e2e.mjs "$LABEL-hard" --set hard > "docs/eval/.cache/$LABEL-hard.log" 2>&1
pkill -f "next dev --port 3100"
tail -n 8 "docs/eval/.cache/$LABEL-main.log" "docs/eval/.cache/$LABEL-hard.log"
