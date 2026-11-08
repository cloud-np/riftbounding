#!/usr/bin/env python3
"""Politely download a small sample of card images (small-v2 + original + one localized)
for local dev, using the exact client URL pattern."""
import json, os, time, urllib.request, sys

BASE = "https://assets.riftatlas-workers.com/riftbound/cards"
OUT = ".recon/site/cards-sample"
rev = json.load(open(".recon/api/card-image-revisions.json"))

SAMPLES = ["OGN-001", "OGN-042", "SFD-001", "UNL-001", "VEN-001", "RAD-001",
           "OGN-101", "OGN-252", "VEN-SP1", "UNL-T02", "ARC-001", "SGN-001"]
# one localized sample (locale segment before slot)
LOCALIZED = [("zh-CN", "ARC-001"), ("fr", "OGN-001"), ("ko", "OGN-001")]

os.makedirs(OUT, exist_ok=True)


def fetch(rel, dest):
    url = f"{BASE}/{rel}"
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        print("skip", dest)
        return
    req = urllib.request.Request(url, headers={"User-Agent": "riftbounding-recon/1.0 (static asset study)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
        open(dest, "wb").write(data)
        print(f"ok {len(data):7d}  {rel}")
    except Exception as e:
        print(f"ERR {rel}: {e}")
    time.sleep(1.2)  # politeness


for cid in SAMPLES:
    v = rev.get(f"{cid}.webp")
    q = f"?v={v}" if v else ""
    fetch(f"small-v2/{cid}.webp{q}", f"{OUT}/{cid}.small-v2.webp")
    if cid in ("OGN-001", "VEN-001"):
        fetch(f"original/{cid}.webp{q}", f"{OUT}/{cid}.original.webp")

for loc, cid in LOCALIZED:
    v = rev.get(f"{cid}.webp")
    q = f"?v={v}" if v else ""
    fetch(f"{loc}/small-v2/{cid}.webp{q}", f"{OUT}/{loc}.{cid}.small-v2.webp")

# also a resized variant through cdn-cgi to prove the transform path works
cid = "OGN-001"
v = rev.get(f"{cid}.webp")
url = (f"https://assets.riftatlas-workers.com/cdn-cgi/image/"
       f"width=384,quality=75,format=auto,fit=scale-down,onerror=redirect"
       f"/riftbound/cards/small-v2/{cid}.webp?v={v}")
dest = f"{OUT}/OGN-001.small-v2.w384.webp"
if not os.path.exists(dest):
    req = urllib.request.Request(url, headers={"User-Agent": "riftbounding-recon/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = r.read()
            open(dest, "wb").write(data)
            print(f"ok {len(data):7d}  cdn-cgi w=384 {cid}  ct={r.headers.get('content-type')}")
    except Exception as e:
        print("ERR cdn-cgi:", e)
