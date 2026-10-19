#!/bin/bash
# Usage: qa/sweep.sh <breakpoint> <width> <height> [routes-file]   (run from the project root)
BP=$1; W=$2; H=$3; ROUTES=${4:-qa/routes.txt}
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p qa/screenshots/$BP qa/logs/$BP
one() {
  r="$1"; BP="$2"; W="$3"; H="$4"
  slug=$(echo "$r" | sed 's#^/$#home#; s#^/##; s#/#__#g')
  tmp=$(mktemp -t qa).png
  "$C" --headless=new --disable-gpu --hide-scrollbars --enable-logging=stderr --v=0 --virtual-time-budget=6000 --window-size=$W,$H --screenshot="$tmp" "http://localhost:3100$r" 2>"qa/logs/$BP/$slug.raw"
  grep -E "CONSOLE|net::ERR|Failed to load|Uncaught" "qa/logs/$BP/$slug.raw" | grep -v CVDisplayLink > "qa/logs/$BP/$slug.log"
  rm -f "qa/logs/$BP/$slug.raw"
  [ -s "qa/logs/$BP/$slug.log" ] || rm -f "qa/logs/$BP/$slug.log"
  if [ -s "$tmp" ]; then sips -s format jpeg -s formatOptions 55 "$tmp" --out "qa/screenshots/$BP/$slug.jpg" >/dev/null 2>&1; else echo "NOSHOT $r" >> qa/logs/$BP/_failures.txt; fi
  rm -f "$tmp"
}
export -f one; export C
rm -f qa/logs/$BP/_failures.txt
cat "$ROUTES" | xargs -P 4 -I{} bash -c 'one "$@"' _ {} $BP $W $H
echo "done $BP: $(ls qa/screenshots/$BP | wc -l) shots, $(ls qa/logs/$BP/*.log 2>/dev/null | wc -l) pages with console/network messages"
