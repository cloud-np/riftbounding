#!/bin/bash
# Generic recursive asset crawler. Usage: crawl2.sh <base-url> <workdir> <seed-files...>
# workdir contains dl/ ; seeds are files in workdir to scan for refs.
set -u
BASE="$1"; WORK="$2"; shift 2
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
mkdir -p "$WORK/dl"

extract_refs() {
  grep -rhoE '(/_next/)?static/immutable/(chunks|media)/[A-Za-z0-9._-]+|[a-zA-Z0-9_-]+\.(js|css)\?dpl=' \
    "$WORK" -r 2>/dev/null | sed -E 's|^static/|/_next/static/|' | sort -u
}

for round in 1 2 3 4 5 6 7 8; do
  extract_refs > "$WORK/refs.txt"
  new=0
  while read -r u; do
    case "$u" in
      /*) : ;;
      *) continue ;;
    esac
    p="$WORK/dl${u%%\?*}"
    if [ ! -f "$p" ]; then
      mkdir -p "$(dirname "$p")"
      code=$(curl -sS -w '%{http_code}' -A "$UA" "$BASE$u" -o "$p")
      if [ "$code" != "200" ]; then echo "FAIL $code $u"; rm -f "$p"; fi
      new=$((new+1)); sleep 0.15
    fi
  done < "$WORK/refs.txt"
  echo "round $round: $(wc -l < "$WORK/refs.txt") refs, $new new, $(find "$WORK/dl" -type f | wc -l) files"
  [ "$new" -eq 0 ] && break
done
