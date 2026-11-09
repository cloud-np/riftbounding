/**
 * Test doubles for the R2-effects seams the play layer consumes (`requiredChoices`,
 * `validateChoices`, `costAdjustments`, `restrictionFor`, `listActivatedAbilities`).
 *
 * The stubs in `src/` return "nothing applies" until R2-effects lands, so play tests install
 * these fakes with `vi.mock(..., () => ({ ...actual, ...fake }))` and register behaviour per test.
 * The fakes follow each stub's documented contract.
 */
import type { Ability, Room, Verdict } from "@rift/protocol";
import type { RulesHost } from "../../../src/host";
import type { ChoiceContext, ChoiceSpec } from "../../../src/effects/choices";
import type { CostAdjustment } from "../../../src/layers/costs";
import type { RestrictionQuery } from "../../../src/layers/restrictions";
import type { ActivatedAbilityEntry } from "../../../src/cards/registry";

type SpecBuilder = (room: Room, host: RulesHost, ctx: ChoiceContext) => ChoiceSpec[];

const SPECS = new Map<string, SpecBuilder>();
const VALIDATORS = new Map<string, (room: Room, host: RulesHost, ctx: ChoiceContext) => Verdict>();
const ADJUSTMENTS: Array<(room: Room, host: RulesHost, query: Record<string, unknown>) => CostAdjustment[]> = [];
const RESTRICTIONS: Array<(room: Room, host: RulesHost, query: RestrictionQuery) => { rule?: string; note?: string } | null> = [];
const ACTIVATED = new Map<string, ActivatedAbilityEntry[]>();
export const calls = { requiredChoices: 0, costAdjustments: [] as Array<Record<string, unknown>> };

/** A spell ability whose choices come from `SPECS.get(id)`. */
export function fakeAbility(id: string): Ability {
  return { kind: "spell", effect: { op: "custom", id: `fake:${id}` } };
}

function idOf(ability: Ability): string | undefined {
  const effect = "effect" in ability ? ability.effect : undefined;
  if (effect && effect.op === "custom" && effect.id.startsWith("fake:")) return effect.id.slice(5);
  return undefined;
}

export function setSpecs(id: string, builder: SpecBuilder): void {
  SPECS.set(id, builder);
}

export function setValidator(id: string, validator: (room: Room, host: RulesHost, ctx: ChoiceContext) => Verdict): void {
  VALIDATORS.set(id, validator);
}

export function addAdjustment(fn: (room: Room, host: RulesHost, query: Record<string, unknown>) => CostAdjustment[]): void {
  ADJUSTMENTS.push(fn);
}

export function addRestriction(fn: (room: Room, host: RulesHost, query: RestrictionQuery) => { rule?: string; note?: string } | null): void {
  RESTRICTIONS.push(fn);
}

export function setActivated(name: string, entries: ActivatedAbilityEntry[]): void {
  ACTIVATED.set(name, entries);
}

export function resetFakes(): void {
  SPECS.clear();
  VALIDATORS.clear();
  ADJUSTMENTS.length = 0;
  RESTRICTIONS.length = 0;
  ACTIVATED.clear();
  calls.requiredChoices = 0;
  calls.costAdjustments = [];
}

/* ---------------------------------------------------------------- contract implementations */

export function requiredChoices(room: Room, host: RulesHost, ability: Ability, ctx: ChoiceContext): ChoiceSpec[] {
  calls.requiredChoices += 1;
  const id = idOf(ability);
  const builder = id ? SPECS.get(id) : undefined;
  return builder ? builder(room, host, ctx) : [];
}

export function validateChoices(room: Room, host: RulesHost, ability: Ability, ctx: ChoiceContext): Verdict {
  const id = idOf(ability);
  const validator = id ? VALIDATORS.get(id) : undefined;
  return validator ? validator(room, host, ctx) : { ok: true };
}

export function costAdjustments(room: Room, host: RulesHost, query: Record<string, unknown>): CostAdjustment[] {
  calls.costAdjustments.push(query);
  return ADJUSTMENTS.flatMap((fn) => fn(room, host, query));
}

export function restrictionFor(room: Room, host: RulesHost, query: RestrictionQuery) {
  for (const fn of RESTRICTIONS) {
    const hit = fn(room, host, query);
    if (hit) return hit;
  }
  return null;
}

export function fakeListActivated(name: string | undefined | null): ActivatedAbilityEntry[] | undefined {
  return name ? ACTIVATED.get(name) : undefined;
}

/* ---------------------------------------------------------------- spec helpers */

/** "a unit at a battlefield" (targeted, exactly one). */
export function unitAtBattlefieldSpec(room: Room, host: RulesHost, key = "target:0"): ChoiceSpec {
  const zones = host.battlefieldZones(room) as string[];
  const options = host
    .activePlayerIds(room)
    .flatMap((player) => zones.flatMap((zone) => host.zoneCards(room, player, zone)))
    .filter((card) => !card.hidden && (host.cardInfo(room, card.id)?.type ?? "").toLowerCase().includes("unit"))
    .map((card) => ({ id: card.id, objectId: card.id }));
  return { key, kind: "choose-target", min: 1, max: 1, targeted: true, options, rule: "355.7" };
}

/** "any unit" (targeted). */
export function anyUnitSpec(room: Room, host: RulesHost, opts: { key?: string; min?: number; max?: number } = {}): ChoiceSpec {
  const zones = ["base", ...(host.battlefieldZones(room) as string[])];
  const options = host
    .activePlayerIds(room)
    .flatMap((player) => zones.flatMap((zone) => host.zoneCards(room, player, zone)))
    .filter((card) => !card.hidden && (host.cardInfo(room, card.id)?.type ?? "").toLowerCase().includes("unit"))
    .map((card) => ({ id: card.id, objectId: card.id }));
  return { key: opts.key ?? "target:0", kind: "choose-target", min: opts.min ?? 1, max: opts.max ?? 1, targeted: true, options, rule: "355.7" };
}
