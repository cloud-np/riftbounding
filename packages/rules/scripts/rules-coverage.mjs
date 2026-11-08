#!/usr/bin/env node
/**
 * rules-coverage.mjs — join tagged rules tests to the official corpus.
 *
 * Test titles carry tags:
 *   [R309.1.a]          a rules test
 *   [EX:467.2.c.3]      a test for the official example of that rule
 * A title may carry several tags. The scan is regex-based so it works before
 * the test suite exists (it then reports 0%).
 *
 * Writes docs/rules-coverage.md.
 * Exit 0 always; `--check` exits 1 when a tag references an unknown rule id.
 *
 * Zero dependencies. Run from packages/rules:
 *   node scripts/rules-coverage.mjs
 *   node scripts/rules-coverage.mjs --check
 *   node scripts/rules-coverage.mjs --test-dir /tmp/fixture   (development)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "../..");
const TEST_DIR = path.join(PKG_DIR, "test");
const CORPUS_FILE = path.join(PKG_DIR, "corpus", "rules.json");
const OUT_FILE = path.join(REPO_ROOT, "docs", "rules-coverage.md");

const ARGS = process.argv.slice(2);
const CHECK = ARGS.includes("--check");
let TEST_DIR_OVERRIDE = null;
for (let i = 0; i < ARGS.length; i += 1) {
  if (ARGS[i] === "--test-dir" && ARGS[i + 1]) {
    TEST_DIR_OVERRIDE = path.resolve(ARGS[++i]);
  }
}

const STRING_RE = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const TAG_RE =
  /\[(R|EX:)\s*([0-9]{3}(?:\.[0-9a-z]+)*(?:\s*,\s*[0-9]{3}(?:\.[0-9a-z]+)*)*)\]/g;
const RANGE_RE =
  /\[(R|EX:)\s*([0-9]{3}(?:\.[0-9a-z]+)*)\s*[–-]\s*(?:R|EX:)?\s*([0-9]{3}(?:\.[0-9a-z]+)*)\]/g;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

function scanTests() {
  const files = walk(TEST_DIR_OVERRIDE || TEST_DIR);
  const counts = new Map(); // rule id -> { R, EX }
  const rangeTags = new Map(); // "R:341-348" -> { kind, start, end, count, first }
  const unknown = new Map(); // rule id -> { kind, count, first: {file,line} }
  let taggedTitles = 0;
  let totalRTags = 0;
  let totalExTags = 0;
  let totalRangeTags = 0;

  const bump = (id, kind, file, line) => {
    let row = counts.get(id);
    if (!row) {
      row = { R: 0, EX: 0 };
      counts.set(id, row);
    }
    row[kind] += 1;
    if (kind === "R") totalRTags += 1;
    else totalExTags += 1;
  };

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let literal;
    STRING_RE.lastIndex = 0;
    while ((literal = STRING_RE.exec(text)) !== null) {
      const body = literal[2];
      if (!body.includes("[R") && !body.includes("[EX:")) continue;
      const line = lineAt(text, literal.index);
      const seen = new Set();
      let tag;
      TAG_RE.lastIndex = 0;
      while ((tag = TAG_RE.exec(body)) !== null) {
        const kind = tag[1] === "R" ? "R" : "EX";
        const ids = tag[2].split(",").map((s) => s.trim()).filter(Boolean);
        for (const id of ids) {
          const key = `${kind}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          bump(id, kind, file, line);
          if (!counts.has(id)) {
            // bump() created it; unknown detection happens against the corpus
            // after scanning, in buildReport().
          }
        }
      }
      let range;
      RANGE_RE.lastIndex = 0;
      while ((range = RANGE_RE.exec(body)) !== null) {
        const kind = range[1] === "R" ? "R" : "EX";
        const key = `${kind}:${range[2]}-${range[3]}`;
        let row = rangeTags.get(key);
        if (!row) {
          row = {
            kind,
            start: range[2],
            end: range[3],
            count: 0,
            first: { file: path.relative(REPO_ROOT, file), line },
          };
          rangeTags.set(key, row);
        }
        row.count += 1;
        totalRangeTags += 1;
        seen.add(key);
      }
      if (seen.size > 0) taggedTitles += 1;
    }
  }

  return {
    files,
    counts,
    rangeTags,
    unknown,
    taggedTitles,
    totalRTags,
    totalExTags,
    totalRangeTags,
  };
}

function pct(n, d) {
  if (d === 0) return "0.0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function esc(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function truncate(text, max = 100) {
  const clean = esc(text);
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function topLevel(id) {
  return Number(id.split(".")[0]);
}

function buildReport(allRules, scan) {
  // Section headings are in the corpus so every parent id resolves, but they
  // are not rule bodies: exclude them from coverage counts and per-rule tables.
  const rules = allRules.filter(
    (rule) => !(rule.depth === 1 && rule.heading === rule.text),
  );
  const ruleIds = new Set(allRules.map((r) => r.id));

  // Unknown ids: tags whose id is not in the corpus.
  for (const [id, row] of scan.counts) {
    if (ruleIds.has(id)) continue;
    scan.unknown.set(id, {
      kind: row.R > 0 ? "R" : "EX",
      count: row.R + row.EX,
      first: null,
    });
  }

  // For the first location of an unknown tag, rescan quickly (kept simple and
  // deterministic; test suites are small).
  if (scan.unknown.size > 0) {
    for (const file of scan.files) {
      const text = fs.readFileSync(file, "utf8");
      let literal;
      STRING_RE.lastIndex = 0;
      while ((literal = STRING_RE.exec(text)) !== null) {
        const body = literal[2];
        let tag;
        TAG_RE.lastIndex = 0;
        while ((tag = TAG_RE.exec(body)) !== null) {
          const ids = tag[2].split(",").map((s) => s.trim()).filter(Boolean);
          for (const id of ids) {
            if (!scan.unknown.has(id)) continue;
            const row = scan.unknown.get(id);
            if (!row.first) {
              row.first = {
                file: path.relative(REPO_ROOT, file),
                line: lineAt(text, literal.index),
              };
            }
          }
        }
      }
    }
  }

  const totalRules = rules.length;
  const testedRules = rules.filter((r) => {
    const row = scan.counts.get(r.id);
    return row && row.R + row.EX > 0;
  }).length;

  // Section table: group by the nearest section heading (rule.heading).
  const sections = new Map();
  for (const rule of rules) {
    const key = rule.heading || "(no heading)";
    let row = sections.get(key);
    if (!row) {
      row = { heading: key, rules: 0, tested: 0, r: 0, ex: 0 };
      sections.set(key, row);
    }
    row.rules += 1;
    const count = scan.counts.get(rule.id);
    if (count && count.R + count.EX > 0) {
      row.tested += 1;
      row.r += count.R;
      row.ex += count.EX;
    }
  }

  const lines = [];
  lines.push("# Rules coverage");
  lines.push("");
  lines.push(
    "Generated by `pnpm --filter @rift/rules coverage:rules` (`node scripts/rules-coverage.mjs`).",
  );
  lines.push("");
  lines.push(
    "Tags are `[R<rule id>]` for rules tests and `[EX:<rule id>]` for tests of the official examples. A title may carry several tags. The scan is regex-based over `packages/rules/test/**/*.{ts,tsx}`; it works before the test suite exists.",
  );
  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | ---: |");
  lines.push(`| Numbered rule entries in corpus | ${allRules.length} |`);
  lines.push(`| Rule bodies (entries minus section headings) | ${totalRules} |`);
  lines.push(`| Rules with at least one test | ${testedRules} |`);
  lines.push(`| Rules coverage | ${pct(testedRules, totalRules)} |`);
  lines.push(`| Tagged test titles | ${scan.taggedTitles} |`);
  lines.push(`| \`[R…]\` tags | ${scan.totalRTags} |`);
  lines.push(`| \`[EX:…]\` tags | ${scan.totalExTags} |`);
  lines.push(
    `| Range tags (not expanded) | ${scan.rangeTags.size} unique / ${scan.totalRangeTags} refs |`,
  );
  lines.push(`| Test/helper files scanned | ${scan.files.length} |`);
  lines.push(`| Unknown rule ids referenced | ${scan.unknown.size} |`);
  lines.push("");
  if (scan.files.length === 0) {
    lines.push(
      `> \`${path.relative(REPO_ROOT, TEST_DIR_OVERRIDE || TEST_DIR)}\` does not exist yet (or has no \`.ts\`/\`.tsx\` files). All rules are reported as untested.`,
    );
    lines.push("");
  }

  lines.push("## Per-section coverage");
  lines.push("");
  lines.push("| Section heading | Rules | Rules with ≥1 test | Coverage | `[R]` tags | `[EX:]` tags |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of sections.values()) {
    lines.push(
      `| ${esc(row.heading)} | ${row.rules} | ${row.tested} | ${pct(row.tested, row.rules)} | ${row.r} | ${row.ex} |`,
    );
  }
  lines.push(
    `| **Total** | **${totalRules}** | **${testedRules}** | **${pct(testedRules, totalRules)}** | **${scan.totalRTags}** | **${scan.totalExTags}** |`,
  );
  lines.push("");

  const ranges = [
    { label: "Sections 300–479", lo: 300, hi: 479 },
    { label: "Sections 800–899", lo: 800, hi: 899 },
  ];
  for (const range of ranges) {
    lines.push(`## Per-rule coverage — ${range.label}`);
    lines.push("");
    lines.push("| Rule | Heading | Tests | `[R]` | `[EX:]` | Text |");
    lines.push("| --- | --- | ---: | ---: | ---: | --- |");
    for (const rule of rules) {
      const top = topLevel(rule.id);
      if (top < range.lo || top > range.hi) continue;
      const count = scan.counts.get(rule.id) || { R: 0, EX: 0 };
      lines.push(
        `| ${rule.id} | ${esc(rule.heading)} | ${count.R + count.EX} | ${count.R} | ${count.EX} | ${truncate(rule.text)} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Range tags (not expanded)");
  lines.push("");
  if (scan.rangeTags.size === 0) {
    lines.push("None.");
  } else {
    lines.push(
      "Range tags such as `[R341–R348]` label a section; they are not expanded into per-rule coverage. Use individual `[R<rule id>]` tags for per-rule credit.",
    );
    lines.push("");
    lines.push("| Range | References | First location |");
    lines.push("| --- | ---: | --- |");
    for (const row of [...scan.rangeTags.values()].sort((a, b) =>
      `${a.start}-${a.end}`.localeCompare(`${b.start}-${b.end}`),
    )) {
      lines.push(
        `| \`[${row.kind}${row.start}–${row.end}]\` | ${row.count} | ${row.first.file}:${row.first.line} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Unknown rule ids in tags");
  lines.push("");
  if (scan.unknown.size === 0) {
    lines.push("None.");
  } else {
    lines.push("These tags reference ids that are not in `corpus/rules.json`:");
    lines.push("");
    lines.push("| Tag | References | First location |");
    lines.push("| --- | ---: | --- |");
    for (const [id, row] of [...scan.unknown.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )) {
      const tag = row.kind === "R" ? `[R${id}]` : `[EX:${id}]`;
      const where = row.first ? `${row.first.file}:${row.first.line}` : "unknown";
      lines.push(`| \`${tag}\` | ${row.count} | ${where} |`);
    }
  }
  lines.push("");
  lines.push(
    CHECK
      ? "`--check` mode: exits non-zero if any tag references an unknown rule id."
      : "Run with `--check` to fail on unknown rule ids.",
  );
  lines.push("");

  return {
    markdown: `${lines.join("\n")}\n`,
    testedRules,
    totalRules,
    unknownCount: scan.unknown.size,
  };
}

function main() {
  if (!fs.existsSync(CORPUS_FILE)) {
    console.error(
      `Missing ${path.relative(REPO_ROOT, CORPUS_FILE)}. Run \`node scripts/build-corpus.mjs\` first.`,
    );
    process.exit(1);
  }
  const rules = JSON.parse(fs.readFileSync(CORPUS_FILE, "utf8"));
  const scan = scanTests();
  const report = buildReport(rules, scan);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report.markdown);

  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_FILE)}`);
  console.log(
    `Rules: ${report.testedRules}/${report.totalRules} tested (${pct(report.testedRules, report.totalRules)}); tagged titles: ${scan.taggedTitles}; unknown ids: ${report.unknownCount}`,
  );
  if (CHECK && report.unknownCount > 0) {
    console.error(
      `--check failed: ${report.unknownCount} unknown rule id(s) referenced.`,
    );
    process.exit(1);
  }
}

main();
