/**
 * Layers — rules 475–482, 143.2, 701–711, 716–727, 801.3.
 *
 * Effective characteristics = the base/printed value plus every modifier that applies:
 *
 * - Might (143.2.a, 479.4 Arithmetic layer): base (`objects.baseMight` ?? printed) + buff
 *   counters (703) + "this turn" Might (`objects.temporaryMight`) + longer object Might
 *   modifications (`objects.mightMods`) + Might passives/continuous effects whose target
 *   matches + Might Bonuses of attached cards (479.4.d / 718.4, modelled as host-targeted
 *   passives) + Assault/Shield while the designation is held (807.1.c / 814.1.c,
 *   `combat-keywords.ts`). 479.4.e: increases are applied before decreases (the sum is order-independent;
 *   snapshotted limits are applied by the op that creates the effect, 479.4.b).
 * - Keywords (479.3 Ability-Altering layer): printed + R1 `grantedKeywords` + object keyword
 *   grants with active durations + keyword passives/continuous effects, minus removals
 *   (801.3.b). Dependent keyword abilities (Level, Empowered: 726–728, 824, 828) are passives
 *   wrapped in a `conditional` modifier, so they are Inactive until their condition holds.
 *
 * Every consumer goes through these helpers, so a granted keyword or Might change is visible to
 * timing, combat and cleanups alike. Pure: no mutation, no Date/rng; the room is only read.
 *
 * Negative Might (143.2.c / 479.4.c / EX:258 / EX:287): the characteristic itself is never
 * floored — `effectiveMight` (= `rawMight`) can be below 0, and effects that calculate increases
 * and decreases use that actual value (143.2.c.1; Double increases by 0, 479.4.c). Only its *uses*
 * clamp: a reference by a spell or ability treats it as 0 (`effects/evaluate.ts` `mightOf`), and
 * so does summing combat damage (`combat/keywords.ts` `combatMight`, 143.2.c / 467); lethal
 * damage is still non-zero (142.4.b / 143.2.b).
 */
import type { Modifier, Room, Selector } from "@rift/protocol";
import type { RulesHost } from "../host";
import { getCardScript } from "../cards/registry";
import { durationActive } from "./durations";
import { activeModifiers, type ActiveModifier } from "./passives";
import { designationMightBonus } from "./combat-keywords";

/* ---------------------------------------------------------------- selector bridge */

/**
 * Does `target` (a modifier's target selector, evaluated for the modifier's controller/source)
 * match `objectId`? Injected by the effects layer at import time to avoid an import cycle.
 */
export type TargetMatcher = (
  room: Room,
  host: RulesHost,
  target: Selector,
  objectId: string,
  scope: { controller: string; sourceObjectId?: string; depth: number; ignoreZone?: boolean },
) => boolean;

let targetMatcher: TargetMatcher = () => false;

export function setLayerTargetMatcher(fn: TargetMatcher): void {
  targetMatcher = fn;
}

export function modifierTargets(
  room: Room,
  host: RulesHost,
  active: ActiveModifier,
  objectId: string,
  depth: number,
  options: { ignoreZone?: boolean; target?: Selector } = {},
): boolean {
  const target = options.target ?? (active.modifier as { target?: Selector }).target;
  if (!target) return false;
  return targetMatcher(room, host, target, objectId, {
    controller: active.controller,
    ...(active.sourceId && !active.sourceId.startsWith("fx") ? { sourceObjectId: active.sourceId } : {}),
    depth,
    ...(options.ignoreZone ? { ignoreZone: true } : {}),
  });
}

/* ---------------------------------------------------------------- might */

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Evaluates a non-fixed Might amount for a modifier's source (injected; no game state). */
export type AmountEvaluator = (
  room: Room,
  host: RulesHost,
  amount: Extract<Modifier, { kind: "might" }>["amount"],
  scope: { controller: string; sourceObjectId?: string; depth: number },
) => number | null;

let amountEvaluator: AmountEvaluator = () => null;

export function setLayerAmountEvaluator(fn: AmountEvaluator): void {
  amountEvaluator = fn;
}

/** Arithmetic layer amount (479.4): fixed numbers, or e.g. "+1 for each card in your trash". */
function modifierMightAmount(room: Room, host: RulesHost, active: ActiveModifier, depth: number): number {
  const modifier = active.modifier;
  if (modifier.kind !== "might") return 0;
  const amount = modifier.amount;
  if (typeof amount === "number") return amount;
  if (amount && typeof amount === "object" && amount.kind === "fixed") return amount.value;
  const value = amountEvaluator(room, host, amount, {
    controller: active.controller,
    ...(active.sourceId && !active.sourceId.startsWith("fx") ? { sourceObjectId: active.sourceId } : {}),
    depth: depth + 1,
  });
  return value ?? 0;
}

/** Unfloored effective Might (479.4). `depth` > 0 skips selector-based modifiers (478.1.c). */
export function rawMight(room: Room, cardId: string, host: RulesHost, depth = 0): number {
  const object = room.rules?.objects[cardId];
  const info = host.cardInfo(room, cardId);
  const base = object?.baseMight ?? info?.might ?? 0;
  let increases = 0;
  let decreases = 0;
  const add = (amount: number) => {
    if (amount >= 0) increases += amount;
    else decreases += amount;
  };
  add(numberOf(object?.temporaryMight));
  add(numberOf(object?.buffs));
  for (const mod of object?.mightMods ?? []) {
    if (durationActive(room, mod)) add(mod.amount);
  }
  if (depth === 0 && room.rules) {
    for (const active of activeModifiers(room, host, depth)) {
      if (active.modifier.kind !== "might") continue;
      if (!modifierTargets(room, host, active, cardId, depth + 1)) continue;
      add(modifierMightAmount(room, host, active, depth));
    }
    // 807.1.c / 814.1.c: Assault/Shield are Might passives while the designation is held. This is
    // the only place their bonus is applied (combat reads `effectiveMight`).
    add(designationMightBonus(room, cardId, host));
  }
  // 479.4.e: increases first, then decreases.
  return base + increases + decreases;
}

/** 143.2.a: Effective Might — the arithmetic-layer value, negative when decreases exceed it. */
export function effectiveMight(room: Room, cardId: string, host: RulesHost): number {
  return rawMight(room, cardId, host);
}

/* ---------------------------------------------------------------- keywords */

/**
 * Where printed keywords come from. The host form `(room, objectId, host)` is the public
 * signature; the array form lets callers that already hold a `CardInfo` (legality/timing) avoid
 * a second host lookup without duplicating the granted-keyword layer.
 */
export type KeywordSource = RulesHost | readonly string[];

/** A keyword string with an optional numeric value ("Shield 2" → ["Shield", 2]). */
export function splitKeyword(keyword: string): { name: string; value?: number } {
  const match = /^(.*?)[\s]+(\d+)$/.exec(keyword.trim());
  if (match) return { name: match[1]!.trim(), value: Number(match[2]) };
  return { name: keyword.trim() };
}

export interface KeywordEntry {
  name: string;
  value?: number;
}

function keywordEntries(
  room: Room,
  objectId: string,
  printed: readonly string[],
  host: RulesHost | null,
  depth: number,
): { added: KeywordEntry[]; removed: Set<string> } {
  const added: KeywordEntry[] = [];
  const removed = new Set<string>();
  for (const keyword of printed) if (typeof keyword === "string") added.push(splitKeyword(keyword));
  const object = room.rules?.objects[objectId];
  for (const keyword of object?.grantedKeywords ?? []) if (typeof keyword === "string") added.push(splitKeyword(keyword));
  for (const grant of object?.keywordGrants ?? []) {
    if (!durationActive(room, grant)) continue;
    if (grant.removed) removed.add(grant.keyword.toLowerCase());
    else added.push({ name: grant.keyword, ...(grant.value !== undefined ? { value: grant.value } : {}) });
  }
  if (host && depth === 0 && room.rules) {
    for (const active of activeModifiers(room, host, depth)) {
      const modifier = active.modifier;
      if (modifier.kind === "keyword") {
        if (!modifierTargets(room, host, active, objectId, depth + 1)) continue;
        added.push(splitKeyword(String(modifier.keyword)));
      } else if (modifier.kind === "custom" && modifier.id === "remove-keyword") {
        if (!modifierTargets(room, host, active, objectId, depth + 1)) continue;
        const keyword = modifier.params?.keyword;
        if (typeof keyword === "string") removed.add(keyword.toLowerCase());
      }
    }
  }
  return { added, removed };
}

/** Printed keywords of an object after script suppression markers (727.1.b, 831.2). */
export function printedKeywordsOf(room: Room, objectId: string, host: RulesHost): string[] {
  return withoutSuppressed(room, objectId, [...(host.cardInfo(room, objectId)?.keywords ?? [])], host);
}

/** Every granted keyword instance (object grants, passives, continuous effects) with its value. */
export function grantedKeywordInstances(room: Room, objectId: string, host: RulesHost): KeywordEntry[] {
  const { added, removed } = keywordEntries(room, objectId, [], host, 0);
  return added.filter((entry) => !removed.has(entry.name.toLowerCase()));
}

/** Keywords removed from an object (801.3.b), lower-cased. */
export function removedKeywords(room: Room, objectId: string, host: RulesHost): Set<string> {
  return keywordEntries(room, objectId, [], host, 0).removed;
}

/**
 * 475–479 (keyword layer): printed keywords plus every grant, minus removals. Comparison is
 * case-insensitive and keeps the first spelling, so granting "Action" to a card that already has
 * `[Action]` does not produce a duplicate. Values ("Shield 2") are reported by
 * `effectiveKeywordValues`; this list carries bare names.
 */
export function effectiveKeywords(room: Room, objectId: string, source: KeywordSource): string[] {
  return keywordsAtDepth(room, objectId, source, 0);
}

export function keywordsAtDepth(room: Room, objectId: string, source: KeywordSource, depth: number): string[] {
  const host = Array.isArray(source) ? hostFromRoom(room) : (source as RulesHost);
  const rawPrinted = Array.isArray(source)
    ? [...source]
    : ((source as RulesHost).cardInfo(room, objectId)?.keywords ?? []);
  const printed = withoutSuppressed(room, objectId, rawPrinted, host);
  const { added, removed } = keywordEntries(room, objectId, printed, host, depth);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of added) {
    const key = entry.name.toLowerCase();
    if (seen.has(key) || removed.has(key)) continue;
    seen.add(key);
    out.push(entry.name);
  }
  return out;
}

/**
 * Keyword values (Assault/Shield/Hunt/Disarm …). 823.2 / 831.2: values from several sources are
 * summed; a valueless instance counts as 1 for Hunt/Disarm (823.1.c.2 / 831.1.c.3).
 */
export function effectiveKeywordValues(room: Room, objectId: string, host: RulesHost): Record<string, number> {
  const info = host.cardInfo(room, objectId);
  const printed = withoutSuppressed(room, objectId, [...(info?.keywords ?? [])], host);
  const textValues = printedKeywordValues(info?.text ?? "");
  const { added, removed } = keywordEntries(room, objectId, [], host, 0);
  const totals: Record<string, number> = {};
  for (const name of printed) {
    const key = name.toLowerCase();
    if (removed.has(key)) continue;
    totals[key] = (totals[key] ?? 0) + (textValues[key] ?? 1);
  }
  for (const entry of added) {
    const key = entry.name.toLowerCase();
    if (removed.has(key)) continue;
    totals[key] = (totals[key] ?? 0) + (entry.value ?? 1);
  }
  return totals;
}

/**
 * Catalog keyword lists include keywords that only appear in reminder text or in a dependent /
 * granted ability (e.g. Clanging Sentry's "Your Mechs have [Disarm]", Gustwalker's "[Level 3] …
 * [Ganking]"). A script marks such a keyword with `{ kind: "keyword", keyword, value: 0 }`: it is
 * not intrinsic, and only applies when an ability actually grants it (727.1.b, 831.2).
 */
function withoutSuppressed(room: Room, objectId: string, printed: string[], host: RulesHost | null): string[] {
  const name = host?.findCard(room, objectId)?.card.name ?? room.rules?.chain.find((item) => item.id === objectId)?.cardName;
  const script = name ? getCardScript(name) : undefined;
  if (!script) return printed;
  const suppressed = new Set(
    script.abilities
      .filter((ability) => ability.kind === "keyword" && ability.value === 0)
      .map((ability) => String((ability as { keyword: string }).keyword).toLowerCase()),
  );
  if (suppressed.size === 0) return printed;
  return printed.filter((keyword) => !suppressed.has(splitKeyword(keyword).name.toLowerCase()));
}

/** "[Assault 2]" / "[SHIELD 2]" / "[Hunt 3]" in printed text → { assault: 2, … }. */
export function printedKeywordValues(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /\[([A-Za-z][A-Za-z-]*(?:\s[A-Za-z][A-Za-z-]*)?)\s+(\d+)\]/g;
  for (const match of text.matchAll(re)) {
    const key = match[1]!.toLowerCase();
    out[key] = Math.max(out[key] ?? 0, Number(match[2]));
  }
  return out;
}

/**
 * The array form of `effectiveKeywords` (legality/timing, cards in hand) has no host, so it sees
 * printed keywords and object-level grants only. TODO(R2-play): call the host form when a
 * passive can grant keywords to cards outside the board (e.g. "Spells you play have [Action]").
 */
function hostFromRoom(_room: Room): RulesHost | null {
  return null;
}
