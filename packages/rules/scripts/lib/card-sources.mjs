/**
 * Source scan of `packages/rules/src/cards` — zero dependencies, shared by
 * `scripts/card-coverage.mjs` (the regex cross-check of the runtime registry) and the registry
 * integrity test (`test/registry/integrity.test.ts`).
 *
 * The runtime registry is the source of truth for names and statuses; this scan only answers
 * "which file registers this name / this custom id" and flags registrations the registry cannot
 * see a literal name for (a helper-built script would be invisible to code search).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const PKG_DIR = path.resolve(SCRIPT_DIR, "../..");
export const REPO_ROOT = path.resolve(PKG_DIR, "../..");
export const CARDS_DIR = path.join(PKG_DIR, "src", "cards");

/** Every `.ts` file under `dir`, sorted. */
export function walkTs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkTs(full));
    else if (/\.ts$/.test(entry.name)) out.push(full);
  }
  return out.sort();
}

function stringLiteral(raw) {
  return raw.replace(/\\(.)/g, "$1");
}

const REGISTER_RE = /registerCardScript\(\{\s*name:\s*"((?:\\.|[^"\\])*)"/g;
const CUSTOM_RE = /register(Custom(?:Condition|Effect))\(\s*"((?:\\.|[^"\\])*)"/g;

/**
 * `{ names: Map<name, string[] files>, customIds: Map<id, { kind, files }>, files }` for the
 * card scripts directory (paths relative to the repo root).
 */
export function scanCardSources(dir = CARDS_DIR) {
  const files = walkTs(dir);
  const names = new Map();
  const customIds = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const relative = path.relative(REPO_ROOT, file);
    for (const match of text.matchAll(REGISTER_RE)) {
      const name = stringLiteral(match[1]);
      names.set(name, [...(names.get(name) ?? []), relative]);
    }
    for (const match of text.matchAll(CUSTOM_RE)) {
      const id = stringLiteral(match[2]);
      const kind = match[1] === "CustomCondition" ? "condition" : "effect";
      const key = `${kind}:${id}`;
      const entry = customIds.get(key) ?? { id, kind, files: [] };
      entry.files.push(relative);
      customIds.set(key, entry);
    }
  }
  return { files: files.map((file) => path.relative(REPO_ROOT, file)), names, customIds };
}

/** Custom-id registrations in a list of files (engine modules register a few, e.g. `keyword:`). */
export function scanCustomIds(files) {
  const out = [];
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(CUSTOM_RE)) {
      out.push({ id: stringLiteral(match[2]), kind: match[1] === "CustomCondition" ? "condition" : "effect", file: path.relative(REPO_ROOT, file) });
    }
  }
  return out;
}
