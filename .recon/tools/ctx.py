#!/usr/bin/env python3
"""Print the enclosing context (backwards) for each quoted string match, to identify trigger sites."""
import re, sys, argparse
ap = argparse.ArgumentParser()
ap.add_argument('pattern')
ap.add_argument('files', nargs='+')
ap.add_argument('--back', type=int, default=260)
ap.add_argument('--fwd', type=int, default=60)
ap.add_argument('--max', type=int, default=200)
a = ap.parse_args()
rx = re.compile(a.pattern)
n = 0
for f in a.files:
    src = open(f, encoding='utf8', errors='replace').read()
    for m in rx.finditer(src):
        n += 1
        if n > a.max:
            print('... truncated'); sys.exit(0)
        s = max(0, m.start() - a.back); e = min(len(src), m.end() + a.fwd)
        line = src.count('\n', 0, m.start()) + 1
        snip = re.sub(r'\s+', ' ', src[s:e])
        print(f'--- {f.split("/")[-1]}:{line}\n    {snip}')
