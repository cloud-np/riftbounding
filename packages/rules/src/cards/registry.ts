/**
 * Card-script registry — §6.1.
 *
 * Keyed by unique card name (alt arts share a script). R1 ships the empty registry; every
 * script added later is registered here by `src/cards/<setCode>/<slug>.ts`.
 */
import type { Ability, CardScript } from "@rift/protocol";

const SCRIPTS = new Map<string, CardScript>();

export function registerCardScript(script: CardScript): CardScript {
  SCRIPTS.set(script.name, script);
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
 * Resolve an ability ref: "spell", "activated:<index>", "triggered:<trigger-kind>".
 *
 * `activated:<index>` is an index into the **full** `abilities` array (not the filtered
 * activated-only list). `activatableAbilities`/`legalIntents` emit the same scheme, so the view
 * and `rules_activate` always agree (F7).
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

/**
 * Activated abilities of a card — rules 376–381, 399+, §6.4.
 *
 * Owner: R2-effects. Consumers: R2-play (activation legality / `legalIntents`) and R2-int (the
 * "Activate (manual)" label).
 *
 * Stub semantics: scripted cards return the script's activated abilities with refs
 * `"activated:<index>"` (index into the full abilities array, exactly like `lookupAbility`) and
 * `manual:false`; unscripted cards (no script, or `status:"manual"`) return `[]` for now.
 * R2-effects will parse `text` into `"manual:<n>"` entries with `manual:true` and
 * `effect: { op: "custom", id: "manual" }` and implement their resolution.
 *
 * Signature is a cross-agent contract: keep it stable.
 */
export function listActivatedAbilities(
  name: string | undefined | null,
  text?: string,
): ActivatedAbilityEntry[] {
  void text;
  const script = getCardScript(name);
  if (!script || script.status === "manual") return [];
  const result: ActivatedAbilityEntry[] = [];
  script.abilities.forEach((ability, index) => {
    if (ability.kind !== "activated") return;
    result.push({ ref: `activated:${index}`, ability, manual: false });
  });
  return result;
}
