/**
 * Activated abilities of an object — rules 164.2, 204.1.b, 376–381, 377.2.b, 430, 818, §6.4.
 *
 * One list per object, shared by `activationVerdict`, `legalIntents` and `rules_activate`:
 *
 * | ref | source | rule |
 * |---|---|---|
 * | `activated:<i>` | the card script (index into the full `abilities` array, F7) | 376 |
 * | `manual:<n>` | R2-effects' `listActivatedAbilities` for unscripted text (§6.4 manual window) | NEW-12 |
 * | `rune:exhaust` | Basic Rune `[Reaction][>] [E]: Add [1]` | 164.2.a |
 * | `rune:recycle` | Basic Rune `[Reaction][>] Recycle this: Add [C]` | 164.2.b |
 * | `equip:<n>` | the n-th `[Equip] <cost>` line: "[Cost]: Attach this gear to a unit you control" | 818.1.c.2 |
 *
 * Costs come from the script (`ability.cost`) or, for unscripted entries, from the printed text
 * before “:” (204.1.b; "[1] or [C]" gives alternative Base Costs).
 */
import type { Ability, CardInstance, Cost, Room } from "@rift/protocol";
import type { CardInfo, LocatedCard, RulesHost } from "../host";
import { listActivatedAbilities, lookupAbility } from "../cards/registry";
import type { ChoiceSpec } from "../effects/choices";
import { cardDomains } from "./cost-model";
import { activatedLines, parseActivatedLine, parseCostAlternatives, parseCostText, parseEquipCosts } from "./cost-text";
import { visibleUnitsAt } from "./control";
import { isBasicRuneName } from "./sources";

export type ActivatedAbility = Extract<Ability, { kind: "activated" }>;

export interface ActivatedAbilityInfo {
  ref: string;
  ability: ActivatedAbility;
  /** Resolves in the §6.4 manual window (unscripted text). */
  manual: boolean;
  builtin?: "rune:exhaust" | "rune:recycle" | "equip";
  /** 204.1.b: alternative Base Costs (exactly one when there is no choice). */
  costs: Cost[];
  keywords: string[];
  /** 430.2: finalizes and resolves immediately. */
  addsResources: boolean;
  /** Resources the engine adds itself (built-in/simple printed Add effects, 430.5). */
  resources?: { energy?: number; power?: Partial<Record<string, number>> };
  /** 377.2.b: "Use this ability only while I'm at a battlefield". */
  conditions: Array<"at-battlefield">;
  text?: string;
}

function isEmptyCost(cost: Cost | undefined): boolean {
  return !cost || Object.keys(cost).length === 0;
}

/** 430.5: "[Add] [1][Calm]" → resources (null when the effect is more than a plain Add). */
export function parseAddEffect(effectText: string, domains: readonly string[]): ActivatedAbilityInfo["resources"] | null {
  const match = /^\[?add\]?\s*((?:\[[^\]]+\]\s*)+)\.?\s*$/i.exec(effectText.trim());
  if (!match) return null;
  const cost = parseCostText(match[1]!);
  if (cost.additional && Object.keys(cost.additional).some((key) => key !== "power:self")) return null;
  if (cost.exhaust || cost.kill) return null;
  const power: Partial<Record<string, number>> = { ...(cost.power ?? {}) };
  const self = cost.additional?.["power:self"];
  if (typeof self === "number" && self > 0) {
    const domain = domains.length === 1 ? domains[0]! : "any";
    power[domain] = (power[domain] ?? 0) + self;
  }
  return {
    ...(typeof cost.energy === "number" && cost.energy > 0 ? { energy: cost.energy } : {}),
    ...(Object.keys(power).length > 0 ? { power } : {}),
  };
}

function conditionsOf(text: string | undefined): Array<"at-battlefield"> {
  return text && /use (?:this ability )?only while i'?m at a battlefield/i.test(text) ? ["at-battlefield"] : [];
}

function permissionKeywords(ability: ActivatedAbility): string[] {
  return (ability.keywords ?? []).map((keyword) => {
    const lower = String(keyword).toLowerCase();
    return lower === "action" ? "Action" : lower === "reaction" ? "Reaction" : String(keyword);
  });
}

function runeAbilities(located: LocatedCard, info: CardInfo | null): ActivatedAbilityInfo[] {
  if (located.zone !== "runeArea" || !isBasicRuneName(info?.name ?? located.card.name)) return [];
  const domain = cardDomains(info ?? { name: located.card.name })[0] ?? "any";
  const self = { targetRef: "self" };
  return [
    {
      ref: "rune:exhaust",
      ability: { kind: "activated", cost: { exhaust: self }, effect: { op: "add", resources: { energy: 1 } }, keywords: ["reaction"], addsResources: true, name: "rune:exhaust" },
      manual: false,
      builtin: "rune:exhaust",
      costs: [{ exhaust: self }],
      keywords: ["Reaction"],
      addsResources: true,
      resources: { energy: 1 },
      conditions: [],
    },
    {
      ref: "rune:recycle",
      ability: { kind: "activated", cost: { additional: { "recycle:self": true } }, effect: { op: "add", resources: { power: { [domain]: 1 } } }, keywords: ["reaction"], addsResources: true, name: "rune:recycle" },
      manual: false,
      builtin: "rune:recycle",
      costs: [{ additional: { "recycle:self": true } }],
      keywords: ["Reaction"],
      addsResources: true,
      resources: { power: { [domain]: 1 } },
      conditions: [],
    },
  ];
}

function equipAbilities(info: CardInfo | null): ActivatedAbilityInfo[] {
  return parseEquipCosts(info?.text).map((costs, index) => ({
    ref: `equip:${index}`,
    ability: {
      kind: "activated",
      cost: costs[0] ?? {},
      effect: { op: "attach", gear: { targetRef: "self" }, to: { chosen: true, targetRef: "target:0" } },
      name: "Equip",
    },
    manual: false,
    builtin: "equip",
    costs: costs.length > 0 ? costs : [{}],
    keywords: [],
    addsResources: false,
    conditions: [],
  }));
}

/** Every activated ability of the object at `located` (any zone; the verdict checks 380). */
export function activatedAbilitiesOf(room: Room, host: RulesHost, located: LocatedCard): ActivatedAbilityInfo[] {
  const info = host.cardInfo(room, located.card.id);
  const domains = cardDomains(info);
  const out: ActivatedAbilityInfo[] = [];
  for (const entry of listActivatedAbilities(info?.name ?? located.card.name, info?.text)) {
    const parsed = entry.text ? parseActivatedLine(entry.text) : null;
    const costs = !isEmptyCost(entry.ability.cost)
      ? [entry.ability.cost]
      : parsed
        ? parseCostAlternatives(parsed.costText)
        : [entry.ability.cost ?? {}];
    const keywords = entry.ability.keywords?.length ? permissionKeywords(entry.ability) : (parsed?.keywords ?? []);
    const addsResources = entry.ability.addsResources === true || (entry.manual && parsed?.addsResources === true);
    const resources = entry.manual && parsed && addsResources ? parseAddEffect(parsed.effectText, domains) : null;
    out.push({
      ref: entry.ref,
      ability: entry.ability,
      manual: entry.manual,
      costs,
      keywords,
      addsResources,
      ...(resources ? { resources } : {}),
      conditions: conditionsOf(entry.text),
      ...(entry.text ? { text: entry.text } : {}),
    });
  }
  out.push(...runeAbilities(located, info));
  out.push(...equipAbilities(info));
  return out;
}

/** Resolve one ref (R1 fallback: `activated:<i>` of a `status:"manual"` script via lookupAbility). */
export function findActivatedAbility(
  room: Room,
  host: RulesHost,
  located: LocatedCard,
  ref: string,
): ActivatedAbilityInfo | null {
  const listed = activatedAbilitiesOf(room, host, located).find((entry) => entry.ref === ref);
  if (listed) return listed;
  if (!/^activated:\d+$/.test(ref)) return null;
  const info = host.cardInfo(room, located.card.id);
  const lookup = lookupAbility(info?.name ?? located.card.name, ref);
  if (!lookup || lookup.ability.kind !== "activated") return null;
  return {
    ref,
    ability: lookup.ability,
    manual: false,
    costs: [lookup.ability.cost ?? {}],
    keywords: permissionKeywords(lookup.ability),
    addsResources: lookup.ability.addsResources === true,
    conditions: [],
  };
}

/** 818.1.b.1: Equip targets a unit its controller controls. */
export function equipTargetSpec(room: Room, host: RulesHost, playerId: string, gearId: string): ChoiceSpec {
  const zones = ["base", ...(host.battlefieldZones(room) as string[])];
  const units: CardInstance[] = zones.flatMap((zone) => visibleUnitsAt(room, host, playerId, zone));
  return {
    key: "target:0",
    kind: "choose-target",
    min: 1,
    max: 1,
    targeted: true,
    rule: "818.1.b.1",
    label: "rules.prompt.equipTarget",
    options: units.filter((unit) => unit.id !== gearId).map((unit) => ({ id: unit.id, objectId: unit.id })),
  };
}

/** The printed activated-ability lines (for UI / coverage). */
export function printedActivatedLines(info: CardInfo | null) {
  return activatedLines(info?.text);
}
