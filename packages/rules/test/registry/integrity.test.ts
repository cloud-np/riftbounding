/**
 * Registry integrity (maintainability review F1/F4/F7/F9, guardrails G2/G3/G6/G7).
 *
 * Imports the production card pool (`src/cards/index.ts` through the package entry) and asserts
 * the invariants a new card or a whole new set must keep. Every check prints the offending
 * names, so a failure says exactly what to fix. Exceptions live in `./allowlists.ts`, one reason
 * per entry; stale exceptions fail too.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_TYPE_NAMES,
  EVENT_TYPE_ALIASES,
  KEYWORD_NAMES,
  RESTRICTION_KINDS,
  RESTRICTION_QUALIFIED,
  RULES_EVENT_TYPES,
  type CardScript,
} from "@rift/protocol";
import { CATALOG_KEYWORD_OVERRIDES, cards, unexplainedCatalogKeywords, type Card } from "@rift/cards";
import {
  KEYWORD_TRIGGERS,
  cardScriptNames,
  parseActivatedAbilityTexts,
  customConditionIds,
  customEffectIds,
  getCardScript,
} from "../../src";
import { CARDS_DIR, PKG_DIR, REPO_ROOT, scanCardSources, scanCustomIds, walkTs } from "../../scripts/lib/card-sources.mjs";
import { CUSTOM_IDS_REFERENCED_FROM_CODE, TEXT_DRIFT } from "./allowlists";

/* ------------------------------------------------------------------ catalog */

const CATALOG = cards();
const TOKEN_NAMES = new Set(CATALOG.filter((card) => card._isToken).map((card) => card.name));
/** The coverage universe (`scripts/card-coverage.mjs`): non-token, non-rune, non-marker names. */
const PLAYABLE = new Map<string, Card>();
for (const card of CATALOG) {
  if (card._isToken || card.type === "Rune" || (card.type as string) === "Card") continue;
  if (!card._isAltArt && !PLAYABLE.has(card.name)) PLAYABLE.set(card.name, card);
}
for (const card of CATALOG) {
  if (card._isToken || card.type === "Rune" || (card.type as string) === "Card") continue;
  if (!PLAYABLE.has(card.name)) PLAYABLE.set(card.name, card);
}
const CATALOG_NAMES = new Set(CATALOG.map((card) => card.name));
const PRINTINGS = new Map<string, Card[]>();
for (const card of CATALOG) PRINTINGS.set(card.name, [...(PRINTINGS.get(card.name) ?? []), card]);
/** Set code of a name's first non-alt printing (catalog order) — the set that owns its script. */
function owningSet(name: string): string | undefined {
  const printings = PRINTINGS.get(name) ?? [];
  return (printings.find((card) => !card._isAltArt) ?? printings[0])?._setCode;
}
const CATALOG_TAGS = new Set(CATALOG.flatMap((card) => card.subtypes ?? []));

/* ------------------------------------------------------------------ registry */

const NAMES = cardScriptNames();
const SCRIPTS = NAMES.map((name) => getCardScript(name)!) as CardScript[];
const SCAN = scanCardSources();

type Visit = (node: Record<string, unknown>, key: string | undefined, script: CardScript) => void;

function walk(node: unknown, visit: Visit, script: CardScript, key?: string): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const entry of node) walk(entry, visit, script, key);
    return;
  }
  const record = node as Record<string, unknown>;
  visit(record, key, script);
  for (const [childKey, value] of Object.entries(record)) walk(value, visit, script, childKey);
}

function eachNode(visit: Visit): void {
  for (const script of SCRIPTS) walk(script.abilities, visit, script);
}

/** `{ kind|op: "custom", id }` references in script JSON. */
function customReferences(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  eachNode((node, _key, script) => {
    if ((node.kind === "custom" || node.op === "custom") && typeof node.id === "string") {
      out.set(node.id, new Set([...(out.get(node.id) ?? []), script.name]));
    }
  });
  return out;
}

function sourceText(dir: string): string {
  return walkTs(dir)
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}

const SRC_DIR = path.join(PKG_DIR, "src");
const ENGINE_FILES = walkTs(SRC_DIR).filter((file) => !file.startsWith(CARDS_DIR + path.sep));

/** Lower-case set dir → custom-id prefixes it may register. */
const SET_PREFIXES: Record<string, string[]> = {
  OGN: ["ogn"],
  SFD: ["sfd"],
  UNL: ["unl"],
  VEN: ["ven"],
  RAD: ["rad"],
  OGS: ["ogs"],
  ARC: ["arc"],
  SGN: ["sgn"],
  lib: ["core"],
};
/** Engine modules may register custom ids only under these prefixes (keyword-synthesized abilities). */
const ENGINE_PREFIXES = ["keyword"];

describe("registry integrity [G2]", () => {
  it("(a) every registered name is a catalog card or token", () => {
    const unknown = NAMES.filter((name) => !CATALOG_NAMES.has(name));
    expect(unknown).toEqual([]);
  });

  it("(b) every playable name has exactly one script, registered by exactly one source file", () => {
    const registered = new Set(NAMES);
    const missingBySet: Record<string, string[]> = {};
    for (const [name, card] of PLAYABLE) {
      if (registered.has(name)) continue;
      (missingBySet[card._setCode ?? "?"] ??= []).push(name);
    }
    // The stub list for a new set: every non-reprint playable name with no script yet.
    expect(missingBySet).toEqual({});
    const multiple = [...SCAN.names].filter(([, files]) => files.length > 1).map(([name, files]) => `${name}: ${files.join(", ")}`);
    expect(multiple).toEqual([]);
  });

  it("(b) the source scan and the runtime registry agree on every name (no helper-built scripts)", () => {
    const scanned = [...SCAN.names.keys()].sort((a, b) => a.localeCompare(b));
    expect(scanned).toEqual(NAMES);
  });

  it("(b) a reprint is scripted once, in the set that first printed it", () => {
    const reprints = [...PRINTINGS]
      .filter(([name]) => PLAYABLE.has(name) || TOKEN_NAMES.has(name))
      .filter(([, printings]) => new Set(printings.map((card) => card._setCode)).size > 1)
      .map(([name]) => name);
    expect(reprints.length).toBeGreaterThan(40);
    const misplaced = reprints
      .filter((name) => SCAN.names.has(name) && !TOKEN_NAMES.has(name))
      .map((name) => ({ name, file: SCAN.names.get(name)![0]!, owner: owningSet(name) }))
      .filter(({ file, owner }) => file.split("/")[4] !== owner)
      .map(({ name, file, owner }) => `${name}: ${file} (first printed in ${owner})`);
    expect(misplaced).toEqual(KNOWN_MISPLACED_REPRINTS);
  });

  it("(c) script text matches a catalog printing (errata/corrections allowlisted)", () => {
    const drift = SCRIPTS.filter((script) => {
      const printings = PRINTINGS.get(script.name) ?? [];
      return !printings.some((card) => normalizeText(card.text) === normalizeText(script.text));
    }).map((script) => script.name);
    expect(drift.sort()).toEqual(Object.keys(TEXT_DRIFT).sort());
  });

  it("(d) status is implemented | partial | manual, and partial/manual scripts explain what is missing", () => {
    const badStatus = SCRIPTS.filter((script) => !["implemented", "partial", "manual"].includes(script.status)).map((script) => script.name);
    expect(badStatus).toEqual([]);
    const noNotes = SCRIPTS.filter((script) => script.status !== "implemented" && !script.notes?.trim()).map((script) => script.name);
    expect(noNotes).toEqual([]);
  });

  it("(e) custom ids in scripts are owner-prefixed; engine concepts use the typed DSL members [F2/G8]", () => {
    const unprefixed: string[] = [];
    eachNode((node, _key, script) => {
      if ((node.kind === "custom" || node.op === "custom") && typeof node.id === "string" && !node.id.includes(":") && node.id !== "manual") {
        unprefixed.push(`${script.name}: ${node.id}`);
      }
    });
    expect(unprefixed).toEqual([]);
  });

  it("(e) every custom id a script references is registered", () => {
    const registered = new Set([...customConditionIds(), ...customEffectIds(), "manual"]);
    const references = customReferences();
    const unregistered: string[] = [];
    eachNode((node, key, script) => {
      // Modifier-position customs are dispatched by the layers, not by the condition/effect tables.
      if (node.kind === "custom" && key === "modifier") return;
      if ((node.kind === "custom" || node.op === "custom") && typeof node.id === "string" && !registered.has(node.id)) {
        unregistered.push(`${script.name}: ${node.id}`);
      }
    });
    expect(unregistered).toEqual([]);
    expect(references.size).toBeGreaterThan(0);
  });

  it("(e) every registered custom id is used (by a script, or by the code that pushes it)", () => {
    const references = customReferences();
    const allSource = sourceText(SRC_DIR);
    const unused = [...customConditionIds(), ...customEffectIds()].filter((id) => {
      if (references.has(id)) return false;
      // Referenced from custom code / the engine: the id literal appears outside its registration.
      const literal = `"${id}"`;
      const occurrences = allSource.split(literal).length - 1;
      const registrations = (allSource.match(new RegExp(`registerCustom(?:Condition|Effect)\\(\\s*${literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g")) ?? []).length;
      return occurrences - registrations <= 0 && !CUSTOM_IDS_REFERENCED_FROM_CODE.has(id);
    });
    expect(unused).toEqual([]);
  });

  it("(f) custom ids are registered once, in the set dir their prefix names (or cards/lib for core:)", () => {
    const runtime = new Set([...customConditionIds().map((id) => `condition:${id}`), ...customEffectIds().map((id) => `effect:${id}`)]);
    const fromCards = [...SCAN.customIds.values()];
    const fromEngine = scanCustomIds(ENGINE_FILES);
    const wrong: string[] = [];
    for (const entry of fromCards) {
      if (entry.files.length > 1) wrong.push(`${entry.id}: registered in ${entry.files.join(", ")}`);
      // One place per set: `<SET>/custom.ts` (or `lib/custom.ts` for `core:`).
      if (!entry.files[0]!.endsWith("/custom.ts")) wrong.push(`${entry.id}: registered outside a custom.ts (${entry.files[0]})`);
      const dir = entry.files[0]!.split("/")[4]!;
      const prefix = entry.id.includes(":") ? entry.id.split(":")[0]! : "";
      if (!(SET_PREFIXES[dir] ?? []).includes(prefix)) wrong.push(`${entry.id}: prefix "${prefix}" registered in ${entry.files[0]}`);
    }
    for (const entry of fromEngine) {
      const prefix = entry.id.includes(":") ? entry.id.split(":")[0]! : "";
      if (prefix && !ENGINE_PREFIXES.includes(prefix)) wrong.push(`${entry.id}: engine module ${entry.file} uses a card prefix`);
      if (!prefix && !GENERIC_ENGINE_IDS.has(entry.id)) wrong.push(`${entry.id}: unprefixed id registered in ${entry.file}`);
    }
    expect(wrong).toEqual([]);
    // Every runtime id has a literal registration the scan can see (no computed ids).
    const scanned = new Set([...fromCards.map((entry) => `${entry.kind}:${entry.id}`), ...fromEngine.map((entry) => `${entry.kind}:${entry.id}`)]);
    const computed = [...runtime].filter((key) => !scanned.has(key) && key !== "effect:keyword:weaponmaster");
    expect(computed).toEqual([]);
  });

  it("(g) keywords, event types, restrictions, card types and tags come from the closed vocabularies", () => {
    const keywords = new Set<string>(KEYWORD_NAMES);
    const events = new Set<string>([...RULES_EVENT_TYPES, ...Object.keys(EVENT_TYPE_ALIASES)]);
    const restrictions = new Set<string>([...RESTRICTION_KINDS, ...RESTRICTION_QUALIFIED]);
    const cardTypes = new Set<string>(CARD_TYPE_NAMES);
    const bad: string[] = [];
    eachNode((node, key, script) => {
      if (typeof node.keyword === "string" && key !== "params" && !keywords.has(node.keyword)) bad.push(`${script.name}: keyword ${node.keyword}`);
      if (key === "event" || key === "matches") {
        for (const type of ([] as unknown[]).concat(node.type)) if (!events.has(String(type))) bad.push(`${script.name}: event ${String(type)}`);
      }
      if (node.kind === "restriction" && !restrictions.has(String(node.restriction))) bad.push(`${script.name}: restriction ${String(node.restriction)}`);
      if (typeof node.cardType === "string" && !cardTypes.has(node.cardType)) bad.push(`${script.name}: cardType ${node.cardType}`);
      if (typeof node.tag === "string" && !CATALOG_TAGS.has(node.tag) && !TOKEN_NAMES.has(`${node.tag} Token`)) bad.push(`${script.name}: tag ${node.tag}`);
      if (Array.isArray(node.keywords)) {
        for (const keyword of node.keywords) {
          if (typeof keyword === "string" && !keywords.has(keyword) && keyword !== "action" && keyword !== "reaction") bad.push(`${script.name}: keywords ${keyword}`);
        }
      }
    });
    expect(bad).toEqual([]);
  });

  it("(g) every listed event type is emitted (engine or card code), and every keyword trigger is a known keyword", () => {
    const allSource = sourceText(SRC_DIR);
    const silent = RULES_EVENT_TYPES.filter((type) => !allSource.includes(`"${type}"`));
    expect(silent).toEqual([]);
    const lower = new Set(KEYWORD_NAMES.map((keyword) => keyword.toLowerCase()));
    const keywordRows = KEYWORD_TRIGGERS.map((row) => row.keyword.toLowerCase());
    expect(keywordRows.filter((keyword) => !lower.has(keyword))).toEqual([]);
    expect(keywordRows.filter((keyword, index) => keywordRows.indexOf(keyword) !== index)).toEqual([]);
  });

  it("(h) every promptKey in the card pool is a rules.prompt.* key with an English string", () => {
    const en = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "packages/i18n/data/i18n-en.json"), "utf8"));
    const prompts = en.ui.rules.prompt as Record<string, unknown>;
    const keys = new Set<string>();
    eachNode((node) => {
      if (typeof node.promptKey === "string") keys.add(node.promptKey);
    });
    for (const match of sourceText(CARDS_DIR).matchAll(/promptKey:\s*"((?:\\.|[^"\\])*)"/g)) keys.add(match[1]!);
    const bad = [...keys].filter((key) => {
      if (!key.startsWith("rules.prompt.")) return true;
      return key.slice("rules.prompt.".length).split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], prompts) === undefined;
    });
    expect(bad).toEqual([]);
  });

  it("(i) every chosen selector of a spell/triggered/activated effect has a choice key after registration", () => {
    const unkeyed: string[] = [];
    for (const script of SCRIPTS) {
      for (const ability of script.abilities) {
        if (ability.kind !== "spell" && ability.kind !== "triggered" && ability.kind !== "activated") continue;
        walk(ability.effect, (node, key) => {
          if (key === "where") return;
          if (node.chosen === true && !("op" in node) && typeof node.targetRef !== "string") unkeyed.push(script.name);
        }, script);
      }
    }
    expect([...new Set(unkeyed)]).toEqual([]);
  });

  it("(j) registered scripts are frozen and share no object with another registration", () => {
    const owner = new Map<object, string>();
    const shared = new Set<string>();
    for (const script of SCRIPTS) {
      expect(Object.isFrozen(script)).toBe(true);
      const seen = new Set<object>();
      walk(script, (node) => {
        if (seen.has(node)) return;
        seen.add(node);
        const previous = owner.get(node);
        if (previous && previous !== script.name) shared.add(`${previous} / ${script.name}`);
        owner.set(node, script.name);
      }, script);
    }
    expect([...shared]).toEqual([]);
  });

  it("(k) catalog keywords that are not the card's own keyword are suppressed by its script [G6]", () => {
    const unsuppressed: string[] = [];
    for (const [name, keywords] of Object.entries(CATALOG_KEYWORD_OVERRIDES)) {
      const script = getCardScript(name);
      if (!script) continue;
      const suppressed = new Set(
        script.abilities.filter((ability) => ability.kind === "suppress-printed-keyword").map((ability) => (ability as { keyword: string }).keyword),
      );
      for (const [keyword, override] of Object.entries(keywords)) {
        if (override.verdict === "not-intrinsic" && !suppressed.has(keyword)) unsuppressed.push(`${name}: ${keyword}`);
      }
    }
    expect(unsuppressed).toEqual([]);
    // Sanity: the override table covers the catalog (the @rift/cards suite checks it exactly).
    const unexplained = CATALOG.filter((card) => !card._isToken).flatMap((card) =>
      unexplainedCatalogKeywords(card).filter((keyword) => !CATALOG_KEYWORD_OVERRIDES[card.name]?.[keyword]),
    );
    expect(unexplained).toEqual([]);
  });
});

describe("card file layout [F8][G12]", () => {
  const SET_DIRS = fs
    .readdirSync(CARDS_DIR)
    .filter((entry) => /^[A-Z]{3}$/.test(entry) || entry === "tokens")
    .sort();

  it("one card per file: <SET>/<slug>.ts in the set that first printed it (tokens/ for token-only names)", () => {
    const wrong: string[] = [];
    for (const [name, files] of SCAN.names) {
      const file = files[0]!;
      const [dir, base] = file.split("/").slice(4) as [string, string];
      const printings = PRINTINGS.get(name) ?? [];
      const first = printings.find((card) => !card._isAltArt) ?? printings[0];
      const expectedDir = first?._isToken ? "tokens" : owningSet(name);
      const plain = slugOf(name);
      const expectedBase = [`${plain}.ts`, `${plain}-${(first?.id ?? "").toLowerCase()}.ts`];
      if (dir !== expectedDir || !expectedBase.includes(base)) wrong.push(`${name}: ${file} (expected ${expectedDir}/${expectedBase[0]})`);
    }
    expect(wrong).toEqual([]);
    const multi = SCAN.files.filter((file) => (fs.readFileSync(path.join(REPO_ROOT, file), "utf8").match(/registerCardScript\(\{/g) ?? []).length > 1);
    expect(multi).toEqual([]);
  });

  it("each set barrel imports its custom.ts first, then every card file in alphabetical order", () => {
    const wrong: string[] = [];
    for (const dir of SET_DIRS) {
      const files = fs
        .readdirSync(path.join(CARDS_DIR, dir))
        .filter((file) => file.endsWith(".ts") && file !== "index.ts" && file !== "custom.ts")
        .map((file) => `./${file.slice(0, -3)}`)
        .sort();
      const hasCustom = fs.existsSync(path.join(CARDS_DIR, dir, "custom.ts"));
      const barrel = fs.readFileSync(path.join(CARDS_DIR, dir, "index.ts"), "utf8");
      const imports = [...barrel.matchAll(/^import "([^"]+)";$/gm)].map((match) => match[1]!);
      const expected = [...(hasCustom ? ["./custom"] : []), ...files];
      if (JSON.stringify(imports) !== JSON.stringify(expected)) wrong.push(dir);
    }
    expect(wrong).toEqual([]);
    const root = fs.readFileSync(path.join(CARDS_DIR, "index.ts"), "utf8");
    const missing = SET_DIRS.filter((dir) => !root.includes(`import "./${dir}";`));
    expect(missing).toEqual([]);
  });
});

describe("card sources [G3][F6]", () => {
  it("[G4] card files import only the card SDK, their own set modules and @rift/protocol types", () => {
    const violations: string[] = [];
    for (const file of walkTs(CARDS_DIR)) {
      const relative = path.relative(CARDS_DIR, file);
      // Infrastructure: the registry, the SDK facade and the shared builders may reach the engine.
      if (!relative.includes(path.sep) || relative.startsWith(`lib${path.sep}`)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"|(?:^|\n)\s*import\s+"([^"]+)"/g)) {
        const spec = match[1] ?? match[2]!;
        const allowed = spec === "@rift/protocol" || spec === "../sdk" || /^\.\/[^/]+$/.test(spec) || (relative.endsWith("index.ts") && /^\.\.\/tokens\/[^/]+$/.test(spec));
        if (!allowed) violations.push(`${relative}: ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("card behaviour lives in the CardScript: no per-card side registrations in card files", () => {
    const offenders: string[] = [];
    for (const file of walkTs(CARDS_DIR)) {
      const text = fs.readFileSync(file, "utf8");
      // Per-card tables keyed by name or unit: use CardScript.additionalCosts / playPermissions
      // and the `no-combat-damage` modifier instead.
      if (/\bregister(AdditionalCosts|CombatContributionFilter)\(/.test(text)) offenders.push(path.relative(CARDS_DIR, file));
      // Effect-granted permissions / costs imposed by other cards are providers in a set's custom.ts.
      if (/\bregister(PlayPermission|AdditionalCostProvider)\(/.test(text) && !/\/custom\.ts$/.test(file)) offenders.push(path.relative(CARDS_DIR, file));
    }
    expect(offenders).toEqual([]);
  });

  it("every card source file is reachable from src/cards/index.ts through imports", () => {
    const reachable = new Set<string>();
    const visit = (file: string): void => {
      if (reachable.has(file) || !fs.existsSync(file)) return;
      reachable.add(file);
      const text = fs.readFileSync(file, "utf8");
      for (const match of text.matchAll(/(?:import|export)\s+(?:[^"';]*?\s+from\s+)?"(\.{1,2}\/[^"]+)"/g)) {
        const base = path.resolve(path.dirname(file), match[1]!);
        for (const candidate of [`${base}.ts`, path.join(base, "index.ts"), base]) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            if (candidate.startsWith(CARDS_DIR + path.sep)) visit(candidate);
            break;
          }
        }
      }
    };
    visit(path.join(CARDS_DIR, "index.ts"));
    const orphans = walkTs(CARDS_DIR)
      .filter((file) => !reachable.has(file))
      .map((file) => path.relative(CARDS_DIR, file));
    expect(orphans).toEqual([]);
  });
});

describe("manual activated abilities [F11]", () => {
  it("the printed-text parser exposes the same activated abilities for every catalog card (pinned table)", async () => {
    // A new cost symbol or activation keyword must not silently hide a manual ability: any change
    // to this table is reviewed (update with `vitest run -u` after checking the diff).
    const table: Record<string, string[]> = {};
    for (const [name, card] of [...PLAYABLE].sort(([a], [b]) => a.localeCompare(b))) {
      const lines = parseActivatedAbilityTexts(card.text);
      if (lines.length > 0) table[name] = lines;
    }
    expect(Object.keys(table).length).toBeGreaterThan(100);
    await expect(`${JSON.stringify(table, null, 1)}\n`).toMatchFileSnapshot("./__snapshots__/activated-abilities.json");
  });
});

/* ------------------------------------------------------------------ helpers & known gaps */

/** Unprefixed custom ids the engine registers: none — engine concepts are typed DSL members (F2/G8). */
const GENERIC_ENGINE_IDS = new Set<string>();

/** Reprints whose script still lives outside the set that first printed them: none. */
const KNOWN_MISPLACED_REPRINTS: string[] = [];

/** The card-file slug: lower case, apostrophes dropped, other non-alphanumerics → "-". */
function slugOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeText(text: string | undefined): string {
  return (text ?? "")
    .split("\n")
    .filter((line) => !/errata text/i.test(line.normalize("NFKD")) && !/^𝗖𝗮𝗿𝗱/u.test(line))
    .join("\n")
    .replace(/\n\s*Flavor Text[\s\S]*$/i, "")
    .replace(/\([^)]*\)/g, "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, "");
}
