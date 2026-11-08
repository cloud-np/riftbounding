#!/bin/bash
# Prettify downloaded JS bundles into .recon/pretty/<tree>/ preserving filenames.
set -eu
cd "$(dirname "$0")/.."
export PATH="$PATH"
pretty_tree() {
  src="$1"; out="$2"
  mkdir -p "$out"
  find "$src" -name '*.js' -type f | while read -r f; do
    b=$(basename "$f" .js)
    [ -f "$out/$b.js" ] && continue
    echo "$f"
  done | xargs -P 6 -I{} sh -c '
    f="{}"; out="'"$out"'"; b=$(basename "$f" .js)
    npx --no-install prettier --parser babel "$f" > "$out/$b.js" 2>/dev/null || { echo "PRETTIER FAIL: $f"; exit 1; }
    if [ ! -s "$out/$b.js" ]; then rm -f "$out/$b.js"; echo "EMPTY: $f"; fi
  '
}
pretty_tree site/dl/_next/static/immutable/chunks pretty/site
pretty_tree site/playapp/dl/_next/static/immutable/chunks pretty/playapp
echo "site: $(find pretty/site -name '*.js' | wc -l) files, playapp: $(find pretty/playapp -name '*.js' | wc -l) files"
du -sh pretty/site pretty/playapp
