#!/usr/bin/env node
/**
 * build-corpus.mjs — build the machine-readable Riftbound Core Rules corpus.
 *
 * Source of truth:
 *   Riftbound Core Rules, Last Updated 2026-10-09 (effective 2026-10-16)
 *   https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/5c7946f7c3b8c6e0faff85ab6dadc6d2e721ea94.pdf
 *
 * The script downloads the official PDF, extracts it with `pdftotext -layout`,
 * and writes:
 *   corpus/core-rules-2026-10-09.txt   raw extracted text
 *   corpus/rules.json                  ordered rule entries
 *   corpus/examples.json               every "Example:" passage
 *   corpus/SOURCE.md                   provenance + parsing caveats
 *
 * Zero dependencies. Run from packages/rules:
 *   node scripts/build-corpus.mjs
 *   node scripts/build-corpus.mjs --pdf /tmp/core-rules.pdf
 *   node scripts/build-corpus.mjs --text /tmp/core-rules.txt
 *
 * Design notes:
 * - Rule ids are exactly the numbers printed in the PDF ("002", "309.1.a").
 * - Section headings (e.g. "307. States of the Turn") are kept as entries too,
 *   with their title as `text`. That makes every parent id resolve and every
 *   cited section id addressable. The independent rules index reports ~2,324
 *   rule bodies because it excludes section headings; we print both counts.
 * - `heading` is the most recent depth-1 section heading in document order.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PDF_URL =
  "https://cmsassets.rgpub.io/sanity/files/dsfx7636/news_live/5c7946f7c3b8c6e0faff85ab6dadc6d2e721ea94.pdf";
const LAST_UPDATED = "2026-10-09";
const EFFECTIVE = "2026-10-16";
const EXPECTED_SHA256 =
  "94d41fee86f88b61c4157c0389c0595d990b98e5b42555c99d9f649ee64d1fec";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(SCRIPT_DIR, "..");
const CORPUS_DIR = path.join(PKG_DIR, "corpus");
const RAW_TXT = path.join(CORPUS_DIR, `core-rules-${LAST_UPDATED}.txt`);
const RULES_JSON = path.join(CORPUS_DIR, "rules.json");
const EXAMPLES_JSON = path.join(CORPUS_DIR, "examples.json");
const SOURCE_MD = path.join(CORPUS_DIR, "SOURCE.md");

const RULE_RE = /^(\d{3}(?:\.[0-9a-z]+)*)\.\s+(.*)$/;
const EXAMPLE_RE = /^\s*Example:\s*(.*)$/;
const SEE_RULE_RE = /See rule\s+(\d{3}(?:\.[0-9a-z]+)*)/g;
const AND_RULE_RE = /\band rule\s+(\d{3}(?:\.[0-9a-z]+)*)/g;

function parseArgs(argv) {
  const args = { pdf: null, text: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--pdf") args.pdf = argv[++i];
    else if (argv[i] === "--text") args.text = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log(
        "Usage: node scripts/build-corpus.mjs [--pdf <path>] [--text <path>]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function downloadPdf(dest) {
  process.stdout.write(`Downloading ${PDF_URL}\n`);
  const res = await fetch(PDF_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return buf;
}

function extractText(pdfPath, txtPath) {
  const candidates = ["/usr/bin/pdftotext", "pdftotext"];
  let lastError = null;
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["-layout", pdfPath, txtPath], { stdio: "pipe" });
      return fs.readFileSync(txtPath, "utf8");
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Could not run pdftotext (install poppler-utils). Last error: ${lastError?.message}`,
  );
}

/** Remove form feeds, page headers/footers and standalone page numbers. */
function cleanRawLines(raw) {
  const out = [];
  for (const original of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const line = original.replace(/\f/g, "");
    const trimmed = line.trim();
    if (!trimmed) {
      out.push("");
      continue;
    }
    if (/^Riftbound Core Rules$/i.test(trimmed)) continue;
    if (/^Last Updated:\s*\d{4}-\d{2}-\d{2}$/i.test(trimmed)) continue;
    if (/^\d{1,3}$/.test(trimmed)) continue; // page number footer/header
    out.push(line.replace(/\s+$/g, ""));
  }
  return out;
}

function normalizeText(lines) {
  let text = "";
  for (const line of lines) {
    const part = line.trim();
    if (!part) continue;
    if (!text) text = part;
    else if (text.endsWith("-")) text += part; // rejoin hyphenated line breaks
    else text += ` ${part}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

function isTitleLike(s) {
  if (s.length > 90) return false;
  if (/[.:;!?]$/.test(s)) return false;
  if (/^\*/.test(s) || /^\d+\./.test(s)) return false;
  if (/^[“"]/.test(s)) return true;
  if (!/^[A-Z0-9]/.test(s)) return false;
  const small = new Set([
    "of",
    "the",
    "and",
    "or",
    "to",
    "on",
    "in",
    "a",
    "an",
    "for",
    "from",
    "with",
    "outside",
    "can",
    "be",
    "is",
    "at",
    "by",
    "as",
    "into",
    "its",
    "it",
    "are",
    "not",
  ]);
  const words = s.match(/[A-Za-z][A-Za-z'’-]*/g) || [];
  if (words.length === 0) return false;
  for (const word of words.slice(1)) {
    if (small.has(word.toLowerCase())) continue;
    if (!/^[A-Z0-9]/.test(word)) return false;
  }
  return true;
}

function compareRuleIds(a, b) {
  const pa = a.split(".");
  const pb = b.split(".");
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i += 1) {
    if (pa[i] === undefined) return -1;
    if (pb[i] === undefined) return 1;
    const na = /^\d+$/.test(pa[i]);
    const nb = /^\d+$/.test(pb[i]);
    if (na && nb) {
      const d = Number(pa[i]) - Number(pb[i]);
      if (d !== 0) return d < 0 ? -1 : 1;
    } else if (na !== nb) {
      return na ? -1 : 1;
    } else {
      const d = pa[i].localeCompare(pb[i]);
      if (d !== 0) return d < 0 ? -1 : 1;
    }
  }
  return 0;
}

/**
 * Parse the layout text into rules + examples.
 *
 * A rule owns every non-example line until the next rule number. Blank lines
 * are ignored inside a rule (the PDF uses them as spacing). An "Example:"
 * paragraph ends at the next blank line, the next "Example:" or the next rule.
 * Inline examples (e.g. rule 130.6) are split out of the rule text.
 */
function parseRules(raw) {
  const lines = cleanRawLines(raw);
  const rules = [];
  const examples = [];
  let currentRule = null;
  let currentExample = null;
  let exampleTextLines = [];

  const finishExample = () => {
    if (!currentExample) return;
    const text = normalizeText(exampleTextLines);
    if (text) {
      currentExample.text = text;
      examples.push(currentExample);
      if (currentRule) currentRule.examples.push(currentExample.index);
    }
    currentExample = null;
    exampleTextLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Examples are paragraph-shaped; rules are not (spacing between rules is
      // blank lines, but a wrapped continuation never starts after a blank).
      finishExample();
      continue;
    }

    const ruleMatch = line.match(RULE_RE);
    if (ruleMatch) {
      finishExample();
      const [, id, rest] = ruleMatch;
      currentRule = {
        id,
        parent: id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : null,
        depth: id.split(".").length,
        heading: "",
        text: "",
        seeAlso: [],
        examples: [],
        _lines: [],
        _exampleLines: [],
      };
      rules.push(currentRule);

      // Inline "Example:" inside a rule line (the PDF has exactly one: 130.6).
      const inline = rest.match(/^(.*?)\s+Example:\s*(.*)$/);
      if (inline) {
        currentRule._lines.push(inline[1]);
        currentExample = { index: examples.length, rule: id, text: "" };
        exampleTextLines = [inline[2]];
      } else {
        currentRule._lines.push(rest);
      }
      continue;
    }

    if (!currentRule) continue; // preamble before the first rule

    const exampleMatch = line.match(EXAMPLE_RE);
    if (exampleMatch) {
      finishExample();
      currentExample = {
        index: examples.length,
        rule: currentRule.id,
        text: "",
      };
      exampleTextLines = [exampleMatch[1]];
      continue;
    }

    if (currentExample) {
      exampleTextLines.push(trimmed);
    } else {
      // Inline "Example:" can also start on a wrapped continuation line
      // (rule 130.6 in the 2026-10-09 PDF).
      const inline = trimmed.match(/^(.*?)\s+Example:\s*(.*)$/);
      if (inline) {
        currentRule._lines.push(inline[1]);
        currentExample = {
          index: examples.length,
          rule: currentRule.id,
          text: "",
        };
        exampleTextLines = [inline[2]];
      } else {
        currentRule._lines.push(trimmed);
      }
    }
  }
  finishExample();

  for (const rule of rules) {
    rule.text = normalizeText(rule._lines);
    delete rule._lines;
    delete rule._exampleLines;
  }

  // "See rule …" references can appear in the rule body or inside its examples
  // (e.g. 324.1). Both are relevant to the rule, so merge them in order.
  const byId = new Map(rules.map((r) => [r.id, r]));
  const refsByRule = new Map();
  const addRefs = (ruleId, text) => {
    if (!byId.has(ruleId)) return;
    const refs = refsByRule.get(ruleId) || [];
    SEE_RULE_RE.lastIndex = 0;
    let m;
    while ((m = SEE_RULE_RE.exec(text)) !== null) {
      const ref = m[1];
      if (ref !== ruleId && !refs.includes(ref)) refs.push(ref);
    }
    // "See rule 165. Rune Pools and rule 430. Add …" has a second reference.
    AND_RULE_RE.lastIndex = 0;
    while ((m = AND_RULE_RE.exec(text)) !== null) {
      const ref = m[1];
      if (ref !== ruleId && !refs.includes(ref)) refs.push(ref);
    }
    refsByRule.set(ruleId, refs);
  };
  for (const rule of rules) addRefs(rule.id, rule.text);
  for (const ex of examples) addRefs(ex.rule, ex.text);
  for (const rule of rules) rule.seeAlso = refsByRule.get(rule.id) || [];

  return { rules, examples };
}

function classifySections(rules) {
  const ids = new Set(rules.map((r) => r.id));
  const hasChildren = (id) =>
    rules.some((r) => r.id !== id && r.id.startsWith(`${id}.`));

  // A depth-1 entry is a section heading when it reads like a title, or when
  // it is a bare heading with subrules (e.g. "319.1 After the game ...").
  const isSectionHeading = (rule) => {
    if (rule.depth !== 1) return false;
    const text = rule.text;
    if (isTitleLike(text)) return true;
    if (
      hasChildren(rule.id) &&
      text.length < 80 &&
      !/[.:;!?,”]$/.test(text) &&
      !/^\d+\./.test(text) &&
      !text.startsWith("*")
    ) {
      return true;
    }
    return false;
  };

  let current = "";
  let sectionCount = 0;
  for (const rule of rules) {
    if (isSectionHeading(rule)) {
      current = rule.text;
      sectionCount += 1;
    }
    rule.heading = current || rule.text;
  }
  return { sectionCount };
}

function validate(rules, examples, markerCount) {
  const problems = [];
  const warnings = [];
  const ids = new Set();
  let emptyTexts = 0;
  let orphanParents = 0;

  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    if (ids.has(rule.id)) problems.push(`duplicate rule id ${rule.id}`);
    ids.add(rule.id);
    if (!rule.text) emptyTexts += 1;
    if (rule.parent && !rules.some((r) => r.id === rule.parent)) {
      orphanParents += 1;
      problems.push(`orphan ${rule.id} (parent ${rule.parent} missing)`);
    }
    if (i > 0 && compareRuleIds(rules[i - 1].id, rule.id) >= 0) {
      problems.push(
        `ids not strictly increasing: ${rules[i - 1].id} then ${rule.id}`,
      );
    }
  }

  if (emptyTexts > 0) problems.push(`${emptyTexts} empty rule texts`);
  if (orphanParents > 0) problems.push(`${orphanParents} orphan rules`);
  if (rules.length < 2000) problems.push(`suspiciously few rules: ${rules.length}`);
  if (examples.length < 300 || examples.length > 350) {
    problems.push(`suspicious example count: ${examples.length}`);
  }

  const ruleIds = new Set(rules.map((r) => r.id));
  const unknownRefs = new Set();
  for (const rule of rules) {
    for (const ref of rule.seeAlso) {
      if (!ruleIds.has(ref)) unknownRefs.add(ref);
    }
  }
  if (unknownRefs.size > 0) {
    warnings.push(
      `unknown "See rule" ids: ${[...unknownRefs].sort().join(", ")}`,
    );
  }

  for (const ex of examples) {
    if (!ruleIds.has(ex.rule)) {
      problems.push(`example ${ex.index} points at unknown rule ${ex.rule}`);
    }
    if (!ex.text) problems.push(`example ${ex.index} has empty text`);
  }

  if (markerCount !== examples.length) {
    warnings.push(
      `Example: markers in the raw PDF text (${markerCount}) != parsed examples (${examples.length})`,
    );
  }

  return { problems, warnings };
}

function printSpotChecks(rules) {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const spot = [
    "309.1.a",
    "337.4",
    "346.1",
    "467.2.c.3",
    "806.1.c.1",
    "813.1.b",
  ];
  console.log("\nSpot checks:");
  for (const id of spot) {
    const rule = byId.get(id);
    if (!rule) {
      console.log(`  ${id}: MISSING`);
      continue;
    }
    const text = rule.text.length > 110 ? `${rule.text.slice(0, 107)}...` : rule.text;
    console.log(`  ${id}: ${text}`);
  }
}

function writeSourceMd({ pdfSha, ruleCount, sectionCount, exampleCount, warnings }) {
  const nonHeading = ruleCount - sectionCount;
  const content = `# Riftbound Core Rules corpus — source & method

- **Document:** Riftbound Core Rules
- **Last updated:** ${LAST_UPDATED}
- **Effective:** ${EFFECTIVE}
- **Source URL:** ${PDF_URL}
- **Rules hub:** https://playriftbound.com/en-us/rules-hub/
- **PDF SHA-256:** \`${pdfSha}\`
- **Extraction:** \`pdftotext -layout <pdf> <txt>\` (Poppler)
- **Generated:** \`node scripts/build-corpus.mjs\` from \`packages/rules\`

## Files

| File | Contents |
| --- | --- |
| \`core-rules-${LAST_UPDATED}.txt\` | Raw \`pdftotext -layout\` extraction of the official PDF. |
| \`rules.json\` | Ordered array of every numbered entry: \`{ id, parent, depth, heading, text, seeAlso, examples }\`. |
| \`examples.json\` | Every \`Example:\` passage: \`{ index, rule, text }\`. |

## Counts

- **Numbered entries:** ${ruleCount}
- **Section headings:** ${sectionCount}
- **Rule bodies (entries minus section headings):** ${nonHeading}
  (the independent Rift Watcher rules index reports 2,324; the 3-rule
  difference is the three numbered sub-steps inside rule 481.2, which that
  index promotes to separate rules)
- **Examples:** ${exampleCount}
- **\`See rule …\` references:** extracted into \`seeAlso\` per rule.

## Parsing rules

- A rule id is the number printed in the PDF, including leading zeros for
  sections below 100 (\`002\`, \`053.1\`).
- \`parent\` is the id with its last component removed (\`467.2.c\` for
  \`467.2.c.3\`); top-level entries have \`parent: null\`.
- \`depth\` is the number of dot-separated components (1 for top-level).
- \`heading\` is the most recent depth-1 section heading in document order
  (e.g. \`309.1.a\` → \`States of the Turn\`). Section headings themselves are
  included as entries so every parent id and every \`See rule …\` citation
  resolves; their \`text\` is the heading title.
- \`text\` joins wrapped lines with spaces, re-joins hyphenated line breaks,
  collapses whitespace, and excludes \`Example:\` blocks. \`See rule …\` lines
  remain in the text and are also extracted into \`seeAlso\`; references that
  appear inside a rule's examples are merged into the same \`seeAlso\` array.
- \`examples\` holds 0-based indices into \`examples.json\`. An example belongs
  to the rule whose text it follows. Inline examples (the PDF has one, in
  \`130.6\`) are split out of the rule text.

## Known parsing caveats

- The PDF has one bad cross-reference: \`See rule 103.2.d.\` (in \`103.3.d\`),
  but the Signature-card rules are \`103.3.d\`. The corpus preserves the
  printed reference rather than silently rewriting it; the validator reports
  it as an unknown \`seeAlso\` id.
- Plural \`Examples:\` blocks (e.g. \`832.1.b.1\`) are not split into separate
  examples; only singular \`Example:\` passages are indexed (${exampleCount}).
- Section headings are detected heuristically from title shape and document
  structure, not from PDF font metadata. The independent index's 2,324 rule
  count is a useful sanity check but is not an exact target.
- \`pdftotext\` output can change with Poppler versions; the committed
  \`core-rules-${LAST_UPDATED}.txt\` is the canonical extraction for this
  corpus. The PDF SHA-256 above identifies the source edition.
- Page headers/footers are limited to the title block on page 1; the script
  also strips standalone page numbers if a future extraction adds them.

## Warnings from the last build

${warnings.length === 0 ? "- none" : warnings.map((w) => `- ${w}`).join("\n")}
`;
  fs.writeFileSync(SOURCE_MD, content);
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(CORPUS_DIR, { recursive: true });

  const pdfPath =
    args.pdf || path.join(os.tmpdir(), `riftbound-core-rules-${LAST_UPDATED}.pdf`);
  let pdfBuf = null;
  if (args.text) {
    console.log(`Using provided text: ${args.text}`);
  } else {
    if (args.pdf) {
      pdfBuf = fs.readFileSync(args.pdf);
      console.log(`Using provided PDF: ${args.pdf}`);
    } else {
      pdfBuf = await downloadPdf(pdfPath);
    }
  }

  const pdfSha = pdfBuf ? sha256(pdfBuf) : "n/a (--text used)";
  if (pdfBuf && pdfSha !== EXPECTED_SHA256) {
    console.warn(
      `WARNING: PDF sha256 ${pdfSha} does not match the pinned ${EXPECTED_SHA256}`,
    );
  }

  let rawText;
  if (args.text) {
    rawText = fs.readFileSync(args.text, "utf8");
  } else {
    rawText = extractText(pdfPath, RAW_TXT);
  }
  fs.writeFileSync(RAW_TXT, rawText);

  const { rules, examples } = parseRules(rawText);
  const { sectionCount } = classifySections(rules);
  const markerCount = (rawText.match(/Example:/g) || []).length;
  const { problems, warnings } = validate(rules, examples, markerCount);

  // Compact JSON shape: keep exactly the contract fields.
  const rulesOut = rules.map((r) => ({
    id: r.id,
    parent: r.parent,
    depth: r.depth,
    heading: r.heading,
    text: r.text,
    seeAlso: r.seeAlso,
    examples: r.examples,
  }));

  fs.writeFileSync(RULES_JSON, `${JSON.stringify(rulesOut, null, 2)}\n`);
  fs.writeFileSync(EXAMPLES_JSON, `${JSON.stringify(examples, null, 2)}\n`);
  writeSourceMd({
    pdfSha,
    ruleCount: rules.length,
    sectionCount,
    exampleCount: examples.length,
    warnings,
  });

  console.log(`\nWrote ${path.relative(PKG_DIR, RAW_TXT)}`);
  console.log(`Wrote ${path.relative(PKG_DIR, RULES_JSON)}`);
  console.log(`Wrote ${path.relative(PKG_DIR, EXAMPLES_JSON)}`);
  console.log(`Wrote ${path.relative(PKG_DIR, SOURCE_MD)}`);
  console.log("\nSummary:");
  console.log(`  numbered entries: ${rules.length}`);
  console.log(`  section headings: ${sectionCount}`);
  console.log(
    `  rule bodies:      ${rules.length - sectionCount} (independent index: ~2,324)`,
  );
  console.log(`  examples:         ${examples.length}`);
  console.log(`  pdf sha256:       ${pdfSha}`);
  printSpotChecks(rules);

  if (warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(`  - ${warning}`);
  }
  if (problems.length > 0) {
    console.error("\nValidation FAILED:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
  } else {
    console.log("\nValidation OK: ids increasing, parents resolve, no empty texts.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
