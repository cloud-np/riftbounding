/**
 * Card-script registry — §6.1.
 *
 * Keyed by unique card name (alt arts share a script). Scripts are registered by
 * `src/cards/<setCode>/<slug>.ts` (production) or by tests.
 *
 * Registration normalizes choice keys (355): every `chosen: true` selector without a
 * `targetRef` gets `target:<n>` in document order across each ability, so `requiredChoices`,
 * R2-play's 355 binding (`ChainItem.choices["target:<n>"]`) and the interpreter all use the same
 * keys.
 */
import type { Ability, CardScript, Effect, Selector } from "@rift/protocol";

const SCRIPTS = new Map<string, CardScript>();

function isSelector(value: unknown): value is Selector {
  return !!value && typeof value === "object" && !Array.isArray(value) && !("op" in (value as object));
}

/**
 * Assign `target:<n>` keys to unkeyed chosen selectors, depth-first in document order, skipping
 * numbers that explicitly keyed choices already use (references do not reserve keys).
 */
export function normalizeChoiceKeys(effect: Effect, counter = { next: 0 }): void {
  const used = new Set<string>();
  const collect = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const entry of node) collect(entry);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record.chosen === true && typeof record.targetRef === "string") used.add(record.targetRef);
    for (const value of Object.values(record)) collect(value);
  };
  collect(effect);
  const nextKey = (): string => {
    let key = `target:${counter.next++}`;
    while (used.has(key)) key = `target:${counter.next++}`;
    used.add(key);
    return key;
  };
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry);
      return;
    }
    const record = node as Record<string, unknown>;
    if (isSelector(record) && record.chosen === true && typeof record.targetRef !== "string") {
      record.targetRef = nextKey();
    }
    for (const [key, value] of Object.entries(record)) {
      if (key === "where") continue;
      visit(value);
    }
  };
  visit(effect);
}

function normalizeScript(script: CardScript): CardScript {
  for (const ability of script.abilities) {
    if (ability.kind === "spell" || ability.kind === "triggered" || ability.kind === "activated") {
      normalizeChoiceKeys(ability.effect);
    }
  }
  return script;
}

export function registerCardScript(script: CardScript): CardScript {
  SCRIPTS.set(script.name, normalizeScript(script));
  return script;
}

export function registerCardScripts(scripts: readonly CardScript[]): void {
  for (const script of scripts) registerCardScript(script);
}

export function getCardScript(name: string | undefined | null): CardScript | undefined {
  if (!name) return undefined;
  return SCRIPTS.get(name);
}

export function hasCardScript(name: string | undefined | null): boolean {
  const script = getCardScript(name);
  return !!script && script.status !== "manual";
}

/** Card names with a script (sorted) — used by `scripts/card-coverage.mjs`. */
export function cardScriptNames(): string[] {
  return [...SCRIPTS.keys()].sort((a, b) => a.localeCompare(b));
}

/** Test-only helper: clear the registry between suites. */
export function clearCardScripts(): void {
  SCRIPTS.clear();
}

export interface CardScriptLookup {
  script: CardScript;
  ability: CardScript["abilities"][number];
}

/**
 * Resolve an ability ref: "spell", "activated:<index>", "triggered:<index>" or
 * "triggered:<trigger-kind>".
 *
 * `activated:<index>` / `triggered:<index>` index the **full** `abilities` array (not the filtered
 * list). `activatableAbilities`/`legalIntents` emit the same scheme, so the view and
 * `rules_activate` always agree (F7). The R1 `triggered:<trigger-kind>` form still resolves the
 * first triggered ability with that trigger kind.
 */
export function lookupAbility(
  name: string | undefined,
  ref: string | undefined,
): CardScriptLookup | undefined {
  const script = getCardScript(name);
  if (!script) return undefined;
  const wanted = ref ?? "spell";
  if (wanted === "spell") {
    const ability = script.abilities.find((entry) => entry.kind === "spell");
    return ability ? { script, ability } : undefined;
  }
  const [kind, raw] = wanted.split(":", 2);
  if (kind === "activated") {
    const index = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : 0;
    const ability = script.abilities[index];
    return ability && ability.kind === "activated" ? { script, ability } : undefined;
  }
  if (kind === "triggered") {
    if (raw !== undefined && /^\d+$/.test(raw)) {
      const ability = script.abilities[Number(raw)];
      return ability && ability.kind === "triggered" ? { script, ability } : undefined;
    }
    const ability = script.abilities.find(
      (entry) => entry.kind === "triggered" && (raw === undefined || entry.trigger.kind === raw),
    );
    return ability ? { script, ability } : undefined;
  }
  return undefined;
}

/** One activated ability as the play/int layers see it. */
export interface ActivatedAbilityEntry {
  /** `"activated:<index>"` for scripted (R1 scheme), `"manual:<n>"` for unscripted. */
  ref: string;
  ability: Extract<Ability, { kind: "activated" }>;
  /** `true` => resolves in the §6.4 manual window. */
  manual: boolean;
  /** The ability's printed text (for UI). */
  text?: string;
}

const KEYWORD_ACTIVATED = /^\s*\[(Equip|Empower)\]/i;

/** Strip reminder text "(…)" and the errata banner from printed text. */
function cleanText(text: string): string {
  return text
    .replace(/^.*Card Errata Text.*$/gim, "")
    .replace(/\n\s*Flavor Text[\s\S]*$/i, "")
    .replace(/\([^)]*\)/g, "")
    .trim();
}

/**
 * 377.1: activated abilities are recognized by a ":" preceded by a cost (and 818/827: the Equip
 * and Empower keywords are activated abilities). Returns each activated ability line of the
 * printed text, in order.
 */
export function parseActivatedAbilityTexts(text: string | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const rawLine of cleanText(text).split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (KEYWORD_ACTIVATED.test(line)) {
      out.push(line);
      continue;
    }
    // A cost before ":" — e.g. "[Tap]: …", "[2], [Tap]: …", "Kill this, [Tap]: …".
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const cost = line.slice(0, colon);
    // Skip quoted granted text and "Keyword — …" lines without a cost.
    if (/^["“]/.test(cost)) continue;
    if (/\b(When|At|If|While|As)\b/.test(cost)) continue;
    if (cost.length > 80) continue;
    out.push(line);
  }
  return out;
}

/** 403.3: the activation keywords printed before the cost ("[Reaction] Kill this, [Tap]: …"). */
function activationKeywords(line: string): Array<"action" | "reaction"> {
  const out: Array<"action" | "reaction"> = [];
  if (/^\s*\[Reaction\]/i.test(line)) out.push("reaction");
  if (/^\s*\[Action\]/i.test(line)) out.push("action");
  return out;
}

/**
 * Activated abilities of a card — rules 376–381, 399+, §6.4.
 *
 * Owner: R2-effects. Consumers: R2-play (activation legality / `legalIntents`) and R2-int (the
 * "Activate (manual)" label).
 *
 * Scripted cards return the script's activated abilities with refs `"activated:<index>"` (index
 * into the full abilities array, exactly like `lookupAbility`) and `manual:false`. Unscripted
 * cards (no script, or `status:"manual"`) parse `text` (377.1) into `"manual:<n>"` entries
 * (`n` = 0-based order among the printed activated abilities) with `manual:true` and
 * `effect: { op: "custom", id: "manual" }`; executing that effect opens the §6.4 manual window.
 * Their cost is left empty (`cost: {}`): the player pays it in the manual window.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
export function listActivatedAbilities(
  name: string | undefined | null,
  text?: string,
): ActivatedAbilityEntry[] {
  const script = getCardScript(name);
  if (!script || script.status === "manual") {
    return parseActivatedAbilityTexts(text ?? script?.text).map((line, index) => {
      const keywords = activationKeywords(line);
      return {
        ref: `manual:${index}`,
        ability: {
          kind: "activated" as const,
          cost: {},
          effect: { op: "custom" as const, id: "manual" },
          ...(keywords.length > 0 ? { keywords } : {}),
          ...(/\[Add\]/i.test(line.split(":").slice(1).join(":")) ? { addsResources: true } : {}),
        },
        manual: true,
        text: line,
      };
    });
  }
  const result: ActivatedAbilityEntry[] = [];
  script.abilities.forEach((ability, index) => {
    if (ability.kind !== "activated") return;
    result.push({ ref: `activated:${index}`, ability, manual: false });
  });
  return result;
}
