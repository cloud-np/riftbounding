#!/usr/bin/env python3
"""Build .recon/specs/data/cards.json — normalized copy of the embedded card catalog.

Normalization = deterministic ordering + a small set of derived, non-colliding helper
fields (prefixed `_`), while every original field is preserved verbatim.
"""
import json, os, re

SRC = ".recon/api/cards.embedded.json"
OUT = ".recon/specs/data/cards.json"

SET_ORDER = ["Origins", "Spiritforged", "Unleashed", "Radiance", "Vendetta",
             "Proving Grounds", "Arcane Box Set", "Origins | Nexus Night",
             "Vendetta | Nexus Night", "Spiritforged | Nexus Night", "Secret Garden"]
# code order used by the client (1s-b1v6u63dg2.js `s` map) then the rest
CODE_ORDER = ["OGN", "SFD", "OGS", "ARC", "VEN", "UNL", "RAD", "SGN"]


def set_rank(s):
    return SET_ORDER.index(s) if s in SET_ORDER else len(SET_ORDER)


def card_number(cid):
    m = re.search(r"-(\d+)", cid)
    return int(m.group(1)) if m else 0


raw = json.load(open(SRC))["cards"]

TOKEN_ID = re.compile(r"^[A-Z]{2,4}-T\d+[A-Z]?$", re.I)

out = []
for cid, card in raw.items():
    c = dict(card)  # keep every original field
    code = cid.split("-")[0]
    types = [t for t in re.split(r"\s+", (card.get("type") or "").strip()) if t]
    domains = card.get("domains") or []
    c["_setCode"] = code
    c["_types"] = [t.lower() for t in types]          # "Unit Gear" -> ["unit","gear"]
    c["_domains"] = [d for d in domains if d != "Unknown"]
    c["_isToken"] = bool(TOKEN_ID.match(cid))
    c["_isAltArt"] = bool(card.get("isAltArt"))
    c["_baseCardId"] = card.get("baseCardId", cid)
    out.append(c)

out.sort(key=lambda c: (set_rank(c["set"]), CODE_ORDER.index(c["_setCode"])
                        if c["_setCode"] in CODE_ORDER else 99,
                        card_number(c["id"]), c["id"]))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({
    "schemaVersion": "normalized-v1",
    "source": "api/cards.embedded.json (extracted from playapp chunk 1s-b1v6u63dg2.js; "
              "byte-identical to site chunk 336w80568d601.js)",
    "count": len(out),
    "derived": ["_setCode", "_types", "_domains", "_isToken", "_isAltArt", "_baseCardId"],
    "cards": out,
}, open(OUT, "w"), ensure_ascii=False, separators=(",", ":"))
print("wrote", OUT, len(out), "cards",
      f"{os.path.getsize(OUT)/1024:.0f} KB")
