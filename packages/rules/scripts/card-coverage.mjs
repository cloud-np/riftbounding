#!/usr/bin/env node
/**
 * card-coverage.mjs — card-script coverage for @rift/rules.
 *
 * Reads packages/cards/data/cards.json, reduces it to unique playable card
 * names, scans packages/rules/src/cards for TypeScript script files
 *   name: "…"  +  status: "implemented" | "partial" | "manual"
 * and writes docs/cards-coverage.md.
 *
 * The scan is deliberately regex-based so it works before src/cards/registry.ts
 * exists and while the card-script wave is still landing.
 *
 * Scope decisions (documented in the generated report):
 * - Alt arts collapse to one name (one script per unique name).
 * - Tokens are excluded (created by effects, not deck cards).
 * - Basic runes are excluded (vanilla rune-deck components, no scriptable text).
 * - Battlefields and legends are included (they have abilities and are deck
 *   components).
 * - The type "Card" marker entries (Buff, XP Tracker, Empowered) are excluded.
 * - Banned cards are included; ban status is deck legality, not script coverage.
 * - A name printed in several sets is counted once, under its first non-alt
 *   printing's set in cards.json order.
 *
 * Zero dependencies. Run from packages/rules:
 *   node scripts/card-coverage.mjs
 *   node scripts/card-coverage.mjs --scripts-dir /tmp/fixture   (development)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PKG_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(PKG_DIR, "../..");
const CARDS_FILE = path.join(REPO_ROOT, "packages", "cards", "data", "cards.json");
const SCRIPTS_DIR = path.join(PKG_DIR, "src", "cards");
const OUT_FILE = path.join(REPO_ROOT, "docs", "cards-coverage.md");

const ARGS = process.argv.slice(2);
let SCRIPTS_DIR_OVERRIDE = null;
for (let i = 0; i < ARGS.length; i += 1) {
  if (ARGS[i] === "--scripts-dir" && ARGS[i + 1]) {
    SCRIPTS_DIR_OVERRIDE = path.resolve(ARGS[++i]);
  }
}

const STATUSES = ["implemented", "partial", "manual", "unscripted", "unknown"];
const STATUS_RANK = { implemented: 3, partial: 2, manual: 1, unknown: 0 };
const SET_ORDER = [
  "Origins",
  "Spiritforged",
  "Unleashed",
  "Vendetta",
  "Radiance",
  "Proving Grounds",
  "Arcane Box Set",
  "Secret Garden",
];

const NAME_RE = /\bname\s*:\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const STATUS_RE = /\bstatus\s*:\s*["'](implemented|partial|manual)["']/g;

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

function pct(n, d) {
  if (d === 0) return "0.0%";
  return `${((n / d) * 100).toFixed(1)}%`;
}

function esc(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function setRank(set) {
  const index = SET_ORDER.indexOf(set);
  return index === -1 ? SET_ORDER.length : index;
}

function loadPlayableCards() {
  const raw = JSON.parse(fs.readFileSync(CARDS_FILE, "utf8"));
  const cards = Array.isArray(raw) ? raw : raw.cards;
  if (!Array.isArray(cards)) {
    throw new Error("cards.json does not contain a cards array");
  }

  const byName = new Map();
  for (const card of cards) {
    if (!card || !card.name) continue;
    if (card._isToken) continue;
    if (card._isAltArt) continue;
    if (card.type === "Rune") continue;
    if (card.type === "Card") continue;
    if (!byName.has(card.name)) byName.set(card.name, card);
  }

  // Safety net: a name that only exists as an alt-art printing still belongs
  // to the playable universe (it points at a base card in practice).
  for (const card of cards) {
    if (!card || !card.name) continue;
    if (card._isToken || card.type === "Rune" || card.type === "Card") continue;
    if (!byName.has(card.name)) byName.set(card.name, card);
  }

  return byName;
}

function scanScripts() {
  const files = walk(SCRIPTS_DIR_OVERRIDE || SCRIPTS_DIR);
  const scripts = new Map(); // name -> { status, file }
  const outOfScope = [];
  const warnings = [];

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const names = [];
    const statuses = [];
    let match;
    NAME_RE.lastIndex = 0;
    while ((match = NAME_RE.exec(text)) !== null) {
      names.push({ index: match.index, value: match[2] });
    }
    STATUS_RE.lastIndex = 0;
    while ((match = STATUS_RE.exec(text)) !== null) {
      statuses.push({ index: match.index, value: match[1] });
    }
    if (names.length === 0) continue;

    let statusIndex = 0;
    for (let i = 0; i < names.length; i += 1) {
      const name = names[i];
      const nextName = names[i + 1];
      while (
        statusIndex < statuses.length &&
        statuses[statusIndex].index < name.index
      ) {
        statusIndex += 1;
      }
      const status =
        statusIndex < statuses.length &&
        (!nextName || statuses[statusIndex].index < nextName.index)
          ? statuses[statusIndex++].value
          : "unknown";
      const relative = path.relative(REPO_ROOT, file);
      const previous = scripts.get(name.value);
      if (!previous || STATUS_RANK[status] > STATUS_RANK[previous.status]) {
        scripts.set(name.value, { status, file: relative });
      }
      if (status === "unknown") {
        warnings.push(`${relative}: card "${name.value}" has no status literal`);
      }
    }
  }

  return { files, scripts, outOfScope, warnings };
}

function buildReport(playable, scan) {
  const rows = [];
  for (const [name, card] of playable) {
    const script = scan.scripts.get(name);
    const status = script ? script.status : "unscripted";
    rows.push({
      name,
      type: card.type || "Unknown",
      set: card.set || "Unknown",
      status,
      file: script ? script.file : null,
    });
  }

  const total = rows.length;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const row of rows) counts[row.status] += 1;

  const scripted = counts.implemented + counts.partial + counts.manual;
  const automated = counts.implemented + counts.partial;

  const byType = new Map();
  for (const row of rows) {
    let bucket = byType.get(row.type);
    if (!bucket) {
      bucket = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      bucket.total = 0;
      bucket.type = row.type;
      byType.set(row.type, bucket);
    }
    bucket.total += 1;
    bucket[row.status] += 1;
  }

  const bySet = new Map();
  for (const row of rows) {
    let bucket = bySet.get(row.set);
    if (!bucket) {
      bucket = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      bucket.total = 0;
      bucket.set = row.set;
      bySet.set(row.set, bucket);
    }
    bucket.total += 1;
    bucket[row.status] += 1;
  }

  // Scripts for names outside the playable universe (tokens, runes, markers).
  for (const [name, script] of scan.scripts) {
    if (!playable.has(name)) {
      scan.outOfScope.push({ name, status: script.status, file: script.file });
    }
  }
  scan.outOfScope.sort((a, b) => a.name.localeCompare(b.name));

  const unscriptedBySet = new Map();
  for (const row of rows) {
    if (row.status !== "unscripted") continue;
    let list = unscriptedBySet.get(row.set);
    if (!list) {
      list = [];
      unscriptedBySet.set(row.set, list);
    }
    list.push(row);
  }

  const lines = [];
  lines.push("# Card script coverage");
  lines.push("");
  lines.push(
    "Generated by `pnpm --filter @rift/rules coverage:cards` (`node scripts/card-coverage.mjs`).",
  );
  lines.push("");
  lines.push(
    "A card is scripted when `packages/rules/src/cards/**/*.ts` contains a matching `name: \"…\"` and a `status: \"implemented\" | \"partial\" | \"manual\"` literal. The scan is regex-based so it works before the registry exists.",
  );
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(
    "- **Unique playable names:** alt arts collapse to one name; a name printed in several sets is counted once under its first non-alt printing's set.",
  );
  lines.push(
    "- **Included:** Units, Spells, Gear, Unit Gear, Legends, and Battlefields (legends and battlefields have abilities and are deck components).",
  );
  lines.push(
    "- **Excluded:** tokens (created by effects, not deck cards), basic runes (six vanilla rune-deck names), and the `Card` marker entries (`Buff`, `XP Tracker`, `Empowered`).",
  );
  lines.push(
    "- **Banned cards are included:** ban status is deck legality, not script coverage; they still need scripts for casual/sandbox play.",
  );
  lines.push("");
  lines.push("## Totals by status");
  lines.push("");
  lines.push("| Status | Cards | % of playable |");
  lines.push("| --- | ---: | ---: |");
  for (const status of STATUSES) {
    lines.push(`| ${status} | ${counts[status]} | ${pct(counts[status], total)} |`);
  }
  lines.push(`| **Scripted (any status)** | **${scripted}** | **${pct(scripted, total)}** |`);
  lines.push(`| **Automated (implemented + partial)** | **${automated}** | **${pct(automated, total)}** |`);
  lines.push(`| **Total playable names** | **${total}** | **100.0%** |`);
  lines.push("");
  if (scan.files.length === 0) {
    lines.push(
      `> \`${path.relative(REPO_ROOT, SCRIPTS_DIR_OVERRIDE || SCRIPTS_DIR)}\` does not exist yet (or has no \`.ts\` files). Every playable card is reported as unscripted.`,
    );
    lines.push("");
  }

  lines.push("## By type");
  lines.push("");
  lines.push(
    "| Type | Total | Implemented | Partial | Manual | Unscripted | Unknown | Automated coverage |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const bucket of [...byType.values()].sort(
    (a, b) => b.total - a.total || a.type.localeCompare(b.type),
  )) {
    lines.push(
      `| ${esc(bucket.type)} | ${bucket.total} | ${bucket.implemented} | ${bucket.partial} | ${bucket.manual} | ${bucket.unscripted} | ${bucket.unknown} | ${pct(bucket.implemented + bucket.partial, bucket.total)} |`,
    );
  }
  lines.push("");

  lines.push("## By set");
  lines.push("");
  lines.push(
    "| Set | Total | Implemented | Partial | Manual | Unscripted | Unknown | Automated coverage |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const bucket of [...bySet.values()].sort(
    (a, b) => setRank(a.set) - setRank(b.set) || a.set.localeCompare(b.set),
  )) {
    lines.push(
      `| ${esc(bucket.set)} | ${bucket.total} | ${bucket.implemented} | ${bucket.partial} | ${bucket.manual} | ${bucket.unscripted} | ${bucket.unknown} | ${pct(bucket.implemented + bucket.partial, bucket.total)} |`,
    );
  }
  lines.push("");

  lines.push("## Unscripted cards by set");
  lines.push("");
  lines.push(
    "The full list of playable names with no `name`/`status` script in `packages/rules/src/cards`.",
  );
  lines.push("");
  const setNames = [...unscriptedBySet.keys()].sort(
    (a, b) => setRank(a) - setRank(b) || a.localeCompare(b),
  );
  if (setNames.length === 0) {
    lines.push("None — every playable name has a script.");
    lines.push("");
  } else {
    for (const set of setNames) {
      const list = unscriptedBySet.get(set).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      lines.push(`### ${esc(set)} (${list.length})`);
      lines.push("");
      lines.push("| Card | Type |");
      lines.push("| --- | --- |");
      for (const row of list) {
        lines.push(`| ${esc(row.name)} | ${esc(row.type)} |`);
      }
      lines.push("");
    }
  }

  if (scan.outOfScope.length > 0) {
    lines.push("## Scripts outside the playable set");
    lines.push("");
    lines.push(
      "These script files name a token, rune, marker, or otherwise excluded card. They do not count toward coverage.",
    );
    lines.push("");
    lines.push("| Name | Status | File |");
    lines.push("| --- | --- | --- |");
    for (const row of scan.outOfScope) {
      lines.push(`| ${esc(row.name)} | ${row.status} | \`${row.file}\` |`);
    }
    lines.push("");
  }

  if (scan.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of scan.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }

  return {
    markdown: `${lines.join("\n")}\n`,
    total,
    counts,
    scripted,
    automated,
  };
}

function main() {
  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`Missing ${path.relative(REPO_ROOT, CARDS_FILE)}.`);
    process.exit(1);
  }
  const playable = loadPlayableCards();
  const scan = scanScripts();
  const report = buildReport(playable, scan);

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, report.markdown);

  console.log(`Wrote ${path.relative(REPO_ROOT, OUT_FILE)}`);
  console.log(
    `Playable names: ${report.total}; implemented: ${report.counts.implemented}; partial: ${report.counts.partial}; manual: ${report.counts.manual}; unscripted: ${report.counts.unscripted}; script files: ${scan.files.length}`,
  );
  console.log(
    `Scripted: ${report.scripted}/${report.total} (${pct(report.scripted, report.total)}); automated: ${report.automated}/${report.total} (${pct(report.automated, report.total)})`,
  );
  if (scan.warnings.length > 0) {
    console.warn(`Warnings: ${scan.warnings.length} (see report)`);
  }
}

main();
