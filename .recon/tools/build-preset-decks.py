#!/usr/bin/env python3
"""Build .recon/specs/data/preset-decks.json from the two chunks that define them:
  - playapp 2gkdmhgbdrjcm.js  (module 534432, trimmed sealed-format config)
  - site    02h7l-jglwkxb.js  (module 34432, full sealed-pool generator)
Starter kits are the only decklists embedded in either app bundle."""
import json, os, re, subprocess

OUT = ".recon/specs/data/preset-decks.json"

kits = json.loads(subprocess.run(
    ["node", ".recon/tools/extract-starters.js",
     ".recon/pretty/playapp/2gkdmhgbdrjcm.js"],
    capture_output=True, text=True, check=True).stdout)

sets = {
    "OGN": {"setName": "Origins", "canonicalRunes": {"Fury": "OGN-007", "Calm": "OGN-042",
            "Mind": "OGN-089", "Body": "OGN-126", "Chaos": "OGN-166", "Order": "OGN-214"},
            "baseNumberEnd": 298, "overnumbered": [299, 310]},
    "SFD": {"setName": "Spiritforged", "canonicalRunes": {"Fury": "SFD-R01", "Calm": "SFD-R02",
            "Mind": "SFD-R03", "Body": "SFD-R04", "Chaos": "SFD-R05", "Order": "SFD-R06"},
            "baseNumberEnd": 221, "overnumbered": [222, 251]},
    "UNL": {"setName": "Unleashed", "canonicalRunes": {"Fury": "UNL-R01A", "Calm": "UNL-R02A",
            "Mind": "UNL-R03A", "Body": "UNL-R04A", "Chaos": "UNL-R05A", "Order": "UNL-R06A"},
            "baseNumberEnd": 219, "overnumbered": [220, 238]},
    "VEN": {"setName": "Vendetta", "canonicalRunes": {"Fury": "VEN-R01", "Calm": "VEN-R02",
            "Mind": "VEN-R03", "Body": "VEN-R04", "Chaos": "VEN-R05", "Order": "VEN-R06"},
            "baseNumberEnd": 166, "overnumbered": [167, 197]},
    "RAD": {"setName": "Radiance", "canonicalRunes": {"Fury": "RAD-R01", "Calm": "RAD-R02",
            "Mind": "RAD-R03", "Body": "RAD-R04", "Chaos": "RAD-R05", "Order": "RAD-R06"},
            "baseNumberEnd": 167, "overnumbered": [168, 184]},
}

booster = {"packsPerPool": 5, "packsPerBox": 24, "commonSlots": 7,
           "guaranteedDomainCommons": True, "uncommonSlots": 3,
           "rareOrEpicSlots": 2, "foilSlots": 1, "tokenOrRuneSlots": 1}

sealed_formats = [
    {"id": "radiance-prerift-v1", "label": "Radiance · Pre-Rift", "setCode": "RAD",
     "poolKind": "pre-rift", "status": "active", "publicPlay": True,
     "matchmakingPool": "upcoming", "expectedStarterKitCount": 9, "starterKitSize": 15,
     "starterChampionRarity": "Rare", "booster": dict(booster, chaseSlot=True),
     "odds": {"epicPerPack": 0.25, "alternateArtPerBox": 2, "alternateRunePerBox": 1,
              "overnumberedPerBox": 1 / 3, "signedOvernumberedShare": 0.1,
              "ultimateRarePerPack": 25e-5, "specialArtShare": 0.5, "isEstimate": True},
     "excludedCardCodes": ["RAD-015C", "RAD-015P", "RAD-038C", "RAD-038P", "RAD-085P",
                           "RAD-086AP", "RAD-086BP", "RAD-086P", "RAD-110AP", "RAD-110P",
                           "RAD-R01BP", "RAD-R02BP", "RAD-R03BP", "RAD-R04BP", "RAD-R05BP",
                           "RAD-R06BP"],
     "starterKits": kits["radiance"]},
    {"id": "unleashed-prerift-v1", "label": "Unleashed · Pre-Rift", "setCode": "UNL",
     "poolKind": "pre-rift", "status": "active", "publicPlay": False,
     "matchmakingPool": "upcoming", "expectedStarterKitCount": 6, "starterKitSize": 15,
     "booster": booster,
     "odds": {"epicPerPack": 0.25, "alternateArtPerBox": 2, "alternateRunePerBox": 1,
              "overnumberedPerBox": 1 / 3, "signedOvernumberedShare": 0.1, "isEstimate": True},
     "excludedCardCodes": [],
     "starterKits": kits["unleashed"]},
    {"id": "vendetta-prerift-v1", "label": "Vendetta · Pre-Rift", "setCode": "VEN",
     "poolKind": "pre-rift", "status": "active", "publicPlay": False,
     "matchmakingPool": "upcoming", "expectedStarterKitCount": 9, "starterKitSize": 15,
     "starterChampionRarity": "Rare", "booster": booster,
     "odds": {"epicPerPack": 0.25, "alternateArtPerBox": 2, "alternateRunePerBox": 0,
              "overnumberedPerBox": 1 / 3, "signedOvernumberedShare": 0.1, "isEstimate": True},
     "excludedCardCodes": ["VEN-041A", "VEN-041P", "VEN-069B", "VEN-155A"],
     "starterKits": kits["vendetta"]},
    {"id": "vendetta-sealed", "label": "Vendetta · Sealed", "setCode": "VEN",
     "poolKind": "booster-only", "status": "active", "publicPlay": False,
     "matchmakingPool": "standard", "booster": dict(booster, packsPerPool=6),
     "odds": {"epicPerPack": 0.25, "alternateArtPerBox": 2, "alternateRunePerBox": 0,
              "overnumberedPerBox": 1 / 3, "signedOvernumberedShare": 0.1, "isEstimate": True},
     "excludedCardCodes": ["VEN-041A", "VEN-041P", "VEN-069B", "VEN-155A"],
     "starterKits": []},
]

data = {
    "schemaVersion": "preset-decks-v1",
    "note": "The simulator embeds no constructed preset/starter/featured decks. The only "
            "decklists in the bundles are the sealed Pre-Rift starter kits below "
            "(playapp module 534432 / site module 34432). All constructed decks are "
            "user-created (Convex) or pasted as text / deck codes.",
    "sealedFormatIds": {"unleashed": "unleashed-prerift-v1", "vendetta": "vendetta-prerift-v1",
                        "radiance": "radiance-prerift-v1", "vendettaSealed": "vendetta-sealed"},
    "mixSealed": {"prefix": "mix-", "grammar": "mix-<setLower><count>-... ; sets in canonical "
                  "order OGN,SFD,UNL,VEN; <=12 packs total e.g. mix-ogn2-unl3"},
    "setMeta": sets,
    "sealedFormats": sealed_formats,
    "starterKitSummary": {
        "radiance-prerift-v1": [k["name"] for k in kits["radiance"]],
        "unleashed-prerift-v1": [k["name"] for k in kits["unleashed"]],
        "vendetta-prerift-v1": [k["name"] for k in kits["vendetta"]],
    },
    "knownSealedPreconDomains": {
        "radiance-prerift-v1": "derived at pool generation from the kit legend + champion "
                               "units: first two domains found, else first domain twice",
    },
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
print("wrote", OUT, os.path.getsize(OUT), "bytes",
      sum(len(f["starterKits"]) for f in sealed_formats), "starter kits")
