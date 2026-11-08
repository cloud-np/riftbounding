# Riftbound Core Rules corpus — source & method

- **Document:** Riftbound Core Rules
- **Last updated:** 2026-10-09
- **Effective:** 2026-10-16
- **Source URL:** https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/5c7946f7c3b8c6e0faff85ab6dadc6d2e721ea94.pdf
- **Rules hub:** https://playriftbound.com/en-us/rules-hub/
- **PDF SHA-256:** `94d41fee86f88b61c4157c0389c0595d990b98e5b42555c99d9f649ee64d1fec`
- **Extraction:** `pdftotext -layout <pdf> <txt>` (Poppler)
- **Generated:** `node scripts/build-corpus.mjs` from `packages/rules`

## Files

| File | Contents |
| --- | --- |
| `core-rules-2026-10-09.txt` | Raw `pdftotext -layout` extraction of the official PDF. |
| `rules.json` | Ordered array of every numbered entry: `{ id, parent, depth, heading, text, seeAlso, examples }`. |
| `examples.json` | Every `Example:` passage: `{ index, rule, text }`. |

## Counts

- **Numbered entries:** 2494
- **Section headings:** 173
- **Rule bodies (entries minus section headings):** 2321
  (the independent Rift Watcher rules index reports 2,324; the 3-rule
  difference is the three numbered sub-steps inside rule 481.2, which that
  index promotes to separate rules)
- **Examples:** 321
- **`See rule …` references:** extracted into `seeAlso` per rule.

## Parsing rules

- A rule id is the number printed in the PDF, including leading zeros for
  sections below 100 (`002`, `053.1`).
- `parent` is the id with its last component removed (`467.2.c` for
  `467.2.c.3`); top-level entries have `parent: null`.
- `depth` is the number of dot-separated components (1 for top-level).
- `heading` is the most recent depth-1 section heading in document order
  (e.g. `309.1.a` → `States of the Turn`). Section headings themselves are
  included as entries so every parent id and every `See rule …` citation
  resolves; their `text` is the heading title.
- `text` joins wrapped lines with spaces, re-joins hyphenated line breaks,
  collapses whitespace, and excludes `Example:` blocks. `See rule …` lines
  remain in the text and are also extracted into `seeAlso`; references that
  appear inside a rule's examples are merged into the same `seeAlso` array.
- `examples` holds 0-based indices into `examples.json`. An example belongs
  to the rule whose text it follows. Inline examples (the PDF has one, in
  `130.6`) are split out of the rule text.

## Known parsing caveats

- The PDF has one bad cross-reference: `See rule 103.2.d.` (in `103.3.d`),
  but the Signature-card rules are `103.3.d`. The corpus preserves the
  printed reference rather than silently rewriting it; the validator reports
  it as an unknown `seeAlso` id.
- Plural `Examples:` blocks (e.g. `832.1.b.1`) are not split into separate
  examples; only singular `Example:` passages are indexed (321).
- Section headings are detected heuristically from title shape and document
  structure, not from PDF font metadata. The independent index's 2,324 rule
  count is a useful sanity check but is not an exact target.
- `pdftotext` output can change with Poppler versions; the committed
  `core-rules-2026-10-09.txt` is the canonical extraction for this
  corpus. The PDF SHA-256 above identifies the source edition.
- Page headers/footers are limited to the title block on page 1; the script
  also strips standalone page numbers if a future extraction adds them.

## Warnings from the last build

- unknown "See rule" ids: 103.2.d
