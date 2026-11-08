#!/usr/bin/env python3
"""snip.py PATTERN FILE [--ctx N] [--max N] [--chars C]
Print matched snippets (clipped) so giant minified lines don't flood the terminal."""
import re, sys, argparse

ap = argparse.ArgumentParser()
ap.add_argument('pattern')
ap.add_argument('files', nargs='+')
ap.add_argument('--ctx', type=int, default=0, help='chars of context each side')
ap.add_argument('--max', type=int, default=40, help='max matches')
ap.add_argument('--chars', type=int, default=240, help='max chars per snippet')
a = ap.parse_args()

rx = re.compile(a.pattern)
total = 0
for f in a.files:
    try:
        src = open(f, encoding='utf8', errors='replace').read()
    except Exception as e:
        print(f'!! {f}: {e}'); continue
    for m in rx.finditer(src):
        total += 1
        if total > a.max:
            print('... (truncated)'); sys.exit(0)
        s = max(0, m.start() - a.ctx); e = min(len(src), m.end() + a.ctx)
        line = src.count('\n', 0, m.start()) + 1
        snip = src[s:e].replace('\n', '\\n')
        if len(snip) > a.chars:
            snip = snip[:a.chars] + '…'
        print(f'{f}:{line}: {snip}')
print(f'-- {total} matches')
