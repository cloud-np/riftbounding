#!/usr/bin/env python3
"""Download the static UI assets that are NOT in asset-manifest.json (cosmetics tree,
board-line/points-rail SVGs, membership/metafy art, badges) into .recon/site/assets/extra/.
These are served same-origin by play.riftatlas.com (Next rewrite → CDN)."""
import json, os, time, urllib.request

ORIGIN = "https://play.riftatlas.com"
OUT = ".recon/site/assets/extra"
MAN = json.load(open(".recon/specs/data/cosmetics-manifest.json"))

os.makedirs(OUT, exist_ok=True)


def get(path, with_rev=True):
    rel = path.lstrip("/")
    dest = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("skip", rel)
        return
    rev = MAN.get(path)
    url = f"{ORIGIN}{path}" + (f"?v={rev}" if (with_rev and rev) else "")
    req = urllib.request.Request(url, headers={"User-Agent": "riftbounding-recon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            data = r.read()
        open(dest, "wb").write(data)
        print(f"ok {len(data):8d}  {rel}")
    except Exception as e:
        print(f"ERR {rel}: {e}")
    time.sleep(1.0)


# 1. the only .riv used by the app
get("/cosmetics/poro/pals.riv", with_rev=False)
# 2. board ornaments (both cosmetic board-line styles, 4 corners each)
for style in ("legend", "signature-legend"):
    for c in ("corner-top-left", "corner-top-right", "corner-bottom-left", "corner-bottom-right"):
        get(f"/board-lines/{style}/{c}.svg")
# 3. points rail ornaments
for f in ("legend/frame.svg", "legend/goal-frame.svg", "legend/inlay.svg",
          "signature-legend/frame.svg", "signature-legend/goal-frame.svg",
          "signature-legend/inlay.svg", "ink-brushwork.png"):
    get(f"/points-rail/{f}")
# 4. membership / metafy / badges (small art only)
for f in ("/membership/rift-atlas-membership.webp",
          "/membership/rift-atlas-membership-layers.webp",
          "/membership/rift-atlas-membership-layers-dark.webp",
          "/metafy/ink-seals.webp", "/metafy/poro-heart.svg", "/metafy/poro-wave.svg",
          "/metafy/astronaut.png", "/metafy/astronaut.riv",
          "/ui/tier-badges/metafy-champion-emblem.webp",
          "/ui/tier-badges/metafy-legend-emblem.webp",
          "/ui/tier-badges/metafy-signature-legend-emblem.webp",
          "/ui/tier-badges/metafy-supporter-emblem.webp",
          "/ui/nameplates/metafy-legend-review.webp",
          "/ui/nameplates/metafy-signature-legend-review.webp",
          "/play/board-chain-20260908.webp"):
    get(f)
# 5. one cosmetic playmat thumb+preview and one sleeve store art (small representations)
for f in ("/cosmetics/creators/lootpixie/playmats/table_skin_loot_pixie_poro_pack/thumb.webp",
          "/cosmetics/creators/lootpixie/playmats/table_skin_loot_pixie_poro_pack/preview.webp",
          "/cosmetics/creators/riftatlas/sleeves/sleeve_pack_rift_atlas/store.webp",
          "/cosmetics/creators/lootpixie/tokens/gold/thumb.webp"):
    get(f)
