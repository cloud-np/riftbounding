#!/usr/bin/env node
/**
 * card-coverage.mjs — card-script coverage for @rift/rules, read from the runtime registry.
 *
 * Reads packages/cards/data/cards.json, reduces it to unique playable card names, loads the
 * production card pool (`src/index.ts`, through Node's native TypeScript support and
 * `lib/register-ts.mjs`) and reports each name's registered status (`cardScriptNames()` /
 * `getCardScript()`), then writes docs/cards-coverage.md.
 *
 * Cross-check (G5): a regex scan of `src/cards` (`lib/card-sources.mjs`) must find exactly the
 * registered names, each in one file; any disagreement (a helper-built script, a duplicate, a
 * stray literal) fails with exit 1. The scan also supplies the file column.
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
 * Run from packages/rules (Node >= 22.18):
 *   node scripts/card-coverage.mjs           (write docs/cards-coverage.md)
 *   node scripts/card-coverage.mjs --check   (exit 1 if the committed report is stale)
 */

import fs from "node:fs";
import path from "node:path";
import "./lib/register-ts.mjs";
import { REPO_ROOT, scanCardSources, walkTs } from "./lib/card-sources.mjs";

const CARDS_FILE = path.join(REPO_ROOT, "packages", "cards", "data", "cards.json");
const OUT_FILE = path.join(REPO_ROOT, "docs", "cards-coverage.md");
const INDEX_FILE = path.join(REPO_ROOT, "docs", "cards-index.md");
const TEST_DIR = path.join(REPO_ROOT, "packages", "rules", "test");
const CHECK = process.argv.slice(2).includes("--check");

const STATUSES = ["implemented", "partial", "manual", "unscripted"];
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

let customIdInfo = null;

async function loadRegistry() {
  const rules = await import("../src/index.ts");
  const scripts = new Map();
  const users = new Map();
  const walk = (node, name) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((entry) => walk(entry, name));
    if ((node.kind === "custom" || node.op === "custom") && typeof node.id === "string") {
      users.set(node.id, new Set([...(users.get(node.id) ?? []), name]));
    }
    for (const value of Object.values(node)) walk(value, name);
  };
  for (const name of rules.cardScriptNames()) {
    const script = rules.getCardScript(name);
    scripts.set(name, { status: script.status });
    walk(script.abilities, name);
  }
  customIdInfo = {
    conditions: rules.customConditionIds(),
    effects: rules.customEffectIds(),
    users,
  };
  return scripts;
}

/** Runtime registry + source scan; throws on any disagreement (G5 cross-check). */
async function scanScripts() {
  const registry = await loadRegistry();
  const source = scanCardSources();
  const problems = [];
  for (const [name, files] of source.names) {
    if (!registry.has(name)) problems.push(`scan finds "${name}" (${files.join(", ")}) but the registry does not`);
    if (files.length > 1) problems.push(`"${name}" is registered by several files: ${files.join(", ")}`);
  }
  for (const name of registry.keys()) {
    if (!source.names.has(name)) problems.push(`registry has "${name}" but no \`registerCardScript({ name: "…" })\` literal was found`);
  }
  const scripts = new Map();
  for (const [name, entry] of registry) scripts.set(name, { status: entry.status, file: source.names.get(name)?.[0] ?? "?" });
  return { files: source.files, scripts, outOfScope: [], problems };
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
    "A card is scripted when the runtime registry (`cardScriptNames()` / `getCardScript()`) has a script for its name; the status is the registered script's. A source scan of `packages/rules/src/cards` cross-checks the registry (every name in exactly one file) and supplies the file column.",
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

  lines.push("## By type");
  lines.push("");
  lines.push(
    "| Type | Total | Implemented | Partial | Manual | Unscripted | Automated coverage |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const bucket of [...byType.values()].sort(
    (a, b) => b.total - a.total || a.type.localeCompare(b.type),
  )) {
    lines.push(
      `| ${esc(bucket.type)} | ${bucket.total} | ${bucket.implemented} | ${bucket.partial} | ${bucket.manual} | ${bucket.unscripted} | ${pct(bucket.implemented + bucket.partial, bucket.total)} |`,
    );
  }
  lines.push("");

  lines.push("## By set");
  lines.push("");
  lines.push(
    "| Set | Total | Implemented | Partial | Manual | Unscripted | Automated coverage |",
  );
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const bucket of [...bySet.values()].sort(
    (a, b) => setRank(a.set) - setRank(b.set) || a.set.localeCompare(b.set),
  )) {
    lines.push(
      `| ${esc(bucket.set)} | ${bucket.total} | ${bucket.implemented} | ${bucket.partial} | ${bucket.manual} | ${bucket.unscripted} | ${pct(bucket.implemented + bucket.partial, bucket.total)} |`,
    );
  }
  lines.push("");

  lines.push("## Unscripted cards by set");
  lines.push("");
  lines.push(
    "The full list of playable names with no registered script.",
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
      "Registered scripts for a token, rune, marker, or otherwise excluded card. They do not count toward coverage.",
    );
    lines.push("");
    lines.push("| Name | Status | File |");
    lines.push("| --- | --- | --- |");
    for (const row of scan.outOfScope) {
      lines.push(`| ${esc(row.name)} | ${row.status} | \`${row.file}\` |`);
    }
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

/** `[C:<Card Name>]` tags in test titles → test files (relative to the repo root). */
function cardTestFiles() {
  const out = new Map();
  for (const file of walkTs(TEST_DIR)) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\[C:([^\]]+)\]/g)) {
      const name = match[1].trim();
      const files = out.get(name) ?? new Set();
      files.add(path.relative(REPO_ROOT, file));
      out.set(name, files);
    }
  }
  return out;
}

/** G12: docs/cards-index.md — every scripted name → status, script file, tests citing it. */
function buildIndex(playable, scan) {
  const tests = cardTestFiles();
  const rows = [...scan.scripts].map(([name, script]) => ({
    name,
    set: playable.get(name)?.set ?? "Tokens",
    status: script.status,
    file: script.file,
    tests: [...(tests.get(name) ?? [])].sort(),
  }));
  rows.sort((a, b) => setRank(a.set) - setRank(b.set) || a.set.localeCompare(b.set) || a.name.localeCompare(b.name));
  const lines = [
    "# Card index",
    "",
    "Generated by `pnpm --filter @rift/rules coverage:cards` from the runtime registry: every scripted card name, its status, its script file and the test files whose titles cite it (`[C:<Card Name>]`).",
    "",
  ];
  let current = null;
  for (const row of rows) {
    if (row.set !== current) {
      current = row.set;
      lines.push(`## ${esc(current)}`, "", "| Card | Status | Script | Tests |", "| --- | --- | --- | --- |");
    }
    const testCell = row.tests.length ? row.tests.map((file) => `\`${file.replace("packages/rules/test/", "")}\``).join(", ") : "—";
    lines.push(`| ${esc(row.name)} | ${row.status} | \`${row.file.replace("packages/rules/src/cards/", "")}\` | ${testCell} |`);
    const next = rows[rows.indexOf(row) + 1];
    if (!next || next.set !== current) lines.push("");
  }
  // F10: the custom-id table, generated (it used to be hand-written per lane doc).
  const source = scanCardSources();
  const where = new Map([...source.customIds.values()].map((entry) => [`${entry.kind}:${entry.id}`, entry.files[0]]));
  lines.push(
    "## Custom ids",
    "",
    "Every registered custom condition / effect, where it is registered and the scripts whose JSON references it (ids pushed by custom code are marked \"code\").",
    "",
    "| Id | Kind | Registered in | Used by |",
    "| --- | --- | --- | --- |",
  );
  const ids = [
    ...customIdInfo.conditions.map((id) => ({ id, kind: "condition" })),
    ...customIdInfo.effects.map((id) => ({ id, kind: "effect" })),
  ].sort((a, b) => a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind));
  for (const { id, kind } of ids) {
    const file = where.get(`${kind}:${id}`)?.replace("packages/rules/src/", "") ?? "engine";
    const users = [...(customIdInfo.users.get(id) ?? [])].sort();
    const cell = users.length === 0 ? "code" : users.length > 6 ? `${users.slice(0, 6).map(esc).join(", ")} (+${users.length - 6})` : users.map(esc).join(", ");
    lines.push(`| \`${id}\` | ${kind} | \`${file}\` | ${cell} |`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  if (!fs.existsSync(CARDS_FILE)) {
    console.error(`Missing ${path.relative(REPO_ROOT, CARDS_FILE)}.`);
    process.exit(1);
  }
  const playable = loadPlayableCards();
  const scan = await scanScripts();
  if (scan.problems.length > 0) {
    console.error("Registry / source-scan disagreement (G5):");
    for (const problem of scan.problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
  const report = buildReport(playable, scan);
  const outputs = [
    [OUT_FILE, report.markdown],
    [INDEX_FILE, buildIndex(playable, scan)],
  ];

  for (const [file, markdown] of outputs) {
    if (CHECK) {
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      if (current !== markdown) {
        console.error(`--check failed: ${path.relative(REPO_ROOT, file)} is stale; run \`pnpm --filter @rift/rules coverage:cards\`.`);
        process.exit(1);
      }
      console.log(`${path.relative(REPO_ROOT, file)} is up to date.`);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, markdown);
      console.log(`Wrote ${path.relative(REPO_ROOT, file)}`);
    }
  }
  console.log(
    `Playable names: ${report.total}; implemented: ${report.counts.implemented}; partial: ${report.counts.partial}; manual: ${report.counts.manual}; unscripted: ${report.counts.unscripted}; script files: ${scan.files.length}`,
  );
  console.log(
    `Scripted: ${report.scripted}/${report.total} (${pct(report.scripted, report.total)}); automated: ${report.automated}/${report.total} (${pct(report.automated, report.total)})`,
  );
}

await main();
