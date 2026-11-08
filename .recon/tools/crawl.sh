#!/bin/bash
# Recursive asset crawler for riftatlas.com /play
# Downloads all referenced /_next static chunks + media, following refs inside chunks.
set -u
cd "$(dirname "$0")/.."   # .recon
BASE="https://riftatlas.com"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
SITE=.recon/site
[ -d site ] && SITE=site
mkdir -p "$SITE/dl"

extract_refs() {
  # all refs from html/rsc/js/css; chunks reference each other as "static/immutable/chunks/x.js"
  grep -rhoE '(/_next/)?static/immutable/(chunks|media)/[A-Za-z0-9._-]+' \
    "$SITE/play.html" "$SITE/play.rsc.txt" "$SITE/dl" 2>/dev/null \
    | sed -E 's|^static/|/_next/static/|' | sort -u
}

for round in 1 2 3 4 5 6; do
  extract_refs > "$SITE/refs.txt"
  new=0
  while read -r u; do
    p="$SITE/dl${u}"
    if [ ! -f "$p" ]; then
      mkdir -p "$(dirname "$p")"
      code=$(curl -sS -w '%{http_code}' -A "$UA" "$BASE$u" -o "$p")
      if [ "$code" != "200" ]; then echo "FAIL $code $u"; rm -f "$p"; fi
      new=$((new+1))
      sleep 0.15
    fi
  done < "$SITE/refs.txt"
  echo "round $round: $(wc -l < "$SITE/refs.txt") refs, $new new downloads, $(find "$SITE/dl" -type f | wc -l) files total"
  [ "$new" -eq 0 ] && break
done
