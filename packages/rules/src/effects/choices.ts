/**
 * Play-time choices — rules 355, 355.7, 355.8, 358 (and 403.2–403.4 for abilities).
 *
 * Owner: R2-effects. Consumer: R2-play (`process of play` 355/358 and `legalIntents`).
 * Semantics: `requiredChoices` reports the play-time choices still to be made for `ability`,
 * given the choices already bound in `ctx.choices`, in rule order (mode -> targets -> X). It
 * returns `[]` when nothing is needed or the card is unscripted. `validateChoices` answers
 * whether the bound choices are complete and legal now; resolution also uses it to detect
 * mistargeting (355.8 / 358).
 *
 * What counts as a play-time choice (355.3–355.5, 355.7, 355.12):
 * - `choose_mode` → key "mode" (355.3); targets inside unchosen modes are not asked yet;
 * - every selector with `chosen: true` (key = its `targetRef`, normalized to `target:<n>` at
 *   registration) — including those under `may` (355.12) and both branches of `if`;
 * - `{ kind: "chosen", ref }` player/zone selectors (355.4 move destinations, "choose a
 *   battlefield"/"an opponent");
 * - `{ kind: "x" }` amounts → key "x".
 * Not asked here: picks inside `look`/`search` (355.18, private zones 355.10.a), `choose`
 * (resolution-time), and the choices of `reflexive`/`delayed` abilities (355.5.b).
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type {
  Ability,
  Amount,
  ChoiceRecord,
  Effect,
  PlayerSelector,
  PromptKind,
  PromptOption,
  Room,
  RuleRef,
  Selector,
  SelectorGroupRequirement,
  Verdict,
  ZoneSelector,
} from "@rift/protocol";
import type { RulesHost } from "../host";
import { fail } from "../types";
import type { EvalContext } from "./env";
import { idsOf, makeEnv } from "./env";
import {
  evaluateAmount,
  evaluateCondition,
  isReservedRef,
  opponentsOf,
  playersInTurnOrder,
  resolveSelector,
} from "./evaluate";
import { groupSatisfied } from "./group";
import { bonusDamage } from "../layers/bonus";
import { choiceBounds, choiceOptions, optionFor } from "./targets";

export interface ChoiceSpec {
  /** Key under `ChainItem.choices` where the answer is stored, e.g. "mode", "target:0", "x". */
  key: string;
  /** A core PromptKind: choose-mode | choose-target | choose-card | choose-player | ... */
  kind: PromptKind;
  min: number;
  max: number;
  /** 355.7: chosen objects/players/zones are Targets unless the text says otherwise. */
  targeted: boolean;
  /** The currently legal options; `[]` means no legal choice. */
  options: PromptOption[];
  /** e.g. "355.7". */
  rule: RuleRef;
  label?: string;
  data?: Record<string, unknown>;
}

export interface ChoiceContext {
  controller: string;
  sourceObjectId?: string;
  itemId?: string;
  choices: ChoiceRecord;
}

const RESERVED_ZONE_REFS = new Set(["here", "self-zone", "event-zone", "event-from"]);
const X_OPTIONS = 20;

function evalContext(room: Room, host: RulesHost, ctx: ChoiceContext): EvalContext {
  return {
    room,
    host,
    env: makeEnv({
      controller: ctx.controller,
      ...(ctx.sourceObjectId ? { sourceObjectId: ctx.sourceObjectId } : {}),
      ...(ctx.itemId ? { itemId: ctx.itemId } : {}),
      choices: { ...(ctx.choices ?? {}) },
    }),
  };
}

function isEffect(value: unknown): value is Effect {
  return !!value && typeof value === "object" && typeof (value as { op?: unknown }).op === "string";
}

function abilityEffect(ability: Ability): Effect | null {
  if (ability.kind === "spell" || ability.kind === "triggered" || ability.kind === "activated") return ability.effect;
  return null;
}

interface Collector {
  specs: ChoiceSpec[];
  seen: Set<string>;
  includeBound: boolean;
  ctx: EvalContext;
  requires: Array<{ condition: Extract<Effect, { op: "requires" }>["condition"]; rule?: string }>;
  /** 355.11: group requirements by choice key. */
  groups: Map<string, SelectorGroupRequirement>;
}

function bound(collector: Collector, key: string): boolean {
  const value = collector.ctx.env.choices[key];
  return value !== undefined && value !== null;
}

function addSelector(
  collector: Collector,
  selector: Selector | undefined,
  override?: { min: number; max: number; rule?: RuleRef; data?: Record<string, unknown> },
): void {
  if (!selector || !selector.chosen) return;
  const key = selector.targetRef ?? "target:0";
  if (isReservedRef(key) || collector.seen.has(key)) return;
  collector.seen.add(key);
  if (!collector.includeBound && bound(collector, key)) return;
  const options = choiceOptions(collector.ctx, selector);
  const bounds = override ?? choiceBounds(collector.ctx, selector);
  // 355.11: a group requirement is met by the chosen objects as a whole (UI + validation).
  const data = { ...(override?.data ?? {}), ...(selector.group ? { group: selector.group } : {}) };
  collector.specs.push({
    key,
    kind: selector.pick ? "choose-card" : "choose-target",
    min: bounds.min,
    max: bounds.max,
    targeted: !selector.pick,
    options: options.map((id) => optionFor(collector.ctx, id)),
    rule: override?.rule ?? "355.7",
    ...(selector.label ? { label: selector.label } : {}),
    ...(Object.keys(data).length > 0 ? { data } : {}),
  });
  if (selector.group) collector.groups.set(key, selector.group);
}

/**
 * 355.14.b/c / 715.3: split-damage targets are chosen on play, up to the damage available then
 * (Bonus Damage included). An amount that depends on a choice not made yet is deferred until
 * that choice is bound (`bindChoices` re-queries after each binding).
 */
function addSplitTargets(collector: Collector, effect: Extract<Effect, { op: "deal_split" }>): void {
  addSelector(collector, effect.source);
  addAmount(collector, effect.amount);
  const total = splitTotal(collector.ctx, effect);
  if (total === null) return;
  const selector = effect.target;
  const upTo = !!selector.anyNumber || selector.maxCount !== undefined;
  const cap = selector.maxCount !== undefined ? Math.max(0, evaluateAmount(collector.ctx, selector.maxCount) ?? 0) : total;
  const max = Math.max(0, Math.min(total, cap));
  addSelector(collector, selector, {
    min: upTo ? 0 : Math.min(1, max),
    max,
    rule: "355.14",
    data: { split: true, total },
  });
}

function addPlayer(collector: Collector, player: PlayerSelector | undefined): void {
  if (!player || typeof player === "string" || player.kind !== "chosen") return;
  const key = player.ref ?? "player";
  if (collector.seen.has(key)) return;
  collector.seen.add(key);
  if (!collector.includeBound && bound(collector, key)) return;
  const { room, host, env } = collector.ctx;
  const players = key.startsWith("opponent") ? opponentsOf(room, host, env.controller) : playersInTurnOrder(room, host);
  collector.specs.push({
    key,
    kind: key.startsWith("opponent") ? "choose-opponent" : "choose-player",
    min: 1,
    max: 1,
    targeted: true,
    options: players.map((id) => ({ id, playerId: id, label: host.playerName(room, id) })),
    rule: "355.7",
  });
}

function addZone(collector: Collector, zone: ZoneSelector | undefined, includeBase: boolean): void {
  if (!zone || typeof zone === "string" || zone.kind !== "chosen") return;
  const key = zone.ref ?? "zone";
  if (RESERVED_ZONE_REFS.has(key) || collector.seen.has(key)) return;
  collector.seen.add(key);
  if (!collector.includeBound && bound(collector, key)) return;
  const { room, host } = collector.ctx;
  const zones = [...(includeBase ? ["base"] : []), ...(host.battlefieldZones(room) as string[])];
  collector.specs.push({
    key,
    kind: "choose-battlefield",
    min: 1,
    max: 1,
    targeted: true,
    options: zones.map((id) => ({ id, zone: id })),
    rule: includeBase ? "355.4" : "355.7",
  });
}

function addAmount(collector: Collector, amount: Amount | undefined): void {
  if (amount === undefined || typeof amount === "number") return;
  if (amount.kind === "x") {
    if (collector.seen.has("x")) return;
    collector.seen.add("x");
    if (!collector.includeBound && bound(collector, "x")) return;
    collector.specs.push({
      key: "x",
      kind: "choose-number",
      min: 1,
      max: 1,
      targeted: false,
      options: Array.from({ length: X_OPTIONS + 1 }, (_, value) => ({ id: String(value), value })),
      rule: "355.1",
    });
    return;
  }
  if (amount.kind === "sum" || amount.kind === "min" || amount.kind === "max") {
    for (const part of amount.amounts) addAmount(collector, part);
  }
}

/** Generic field scan for game-action ops (selectors, players, zones, amounts). */
function scanOp(collector: Collector, effect: Effect): void {
  const record = effect as unknown as Record<string, unknown>;
  for (const field of ["target", "a", "b", "gear", "to", "selector", "source"]) {
    const value = record[field];
    if (!value || typeof value !== "object" || isEffect(value)) continue;
    if (field === "to" && effect.op === "move") {
      addZone(collector, value as ZoneSelector, true);
      continue;
    }
    if (field === "to" && effect.op !== "attach") continue;
    addSelector(collector, value as Selector);
  }
  for (const field of ["zone", "location"]) addZone(collector, record[field] as ZoneSelector | undefined, false);
  addPlayer(collector, record.player as PlayerSelector | undefined);
  for (const field of ["amount", "times"]) addAmount(collector, record[field] as Amount | undefined);
}

function walk(collector: Collector, effect: Effect | undefined): void {
  if (!effect) return;
  switch (effect.op) {
    case "seq":
      for (const child of effect.effects) walk(collector, child);
      return;
    case "may":
      walk(collector, effect.effect);
      return;
    case "if":
      walk(collector, effect.then);
      walk(collector, effect.else);
      return;
    case "for_each":
      addSelector(collector, effect.selector);
      walk(collector, effect.effect);
      return;
    case "repeat":
      addAmount(collector, effect.times);
      walk(collector, effect.effect);
      return;
    case "choose_mode": {
      const chosen = collector.ctx.env.choices.mode;
      const modes = idsOf(chosen);
      if (modes.length === 0) {
        if (!collector.seen.has("mode")) {
          collector.seen.add("mode");
          const available = effect.modes.filter((mode) =>
            mode.effect.op !== "requires" ? true : evaluateCondition(collector.ctx, mode.effect.condition),
          );
          collector.specs.push({
            key: "mode",
            kind: "choose-mode",
            min: 1,
            max: 1,
            targeted: false,
            options: available.map((mode) => ({ id: mode.id, ...(mode.label ? { label: mode.label } : {}) })),
            rule: "355.3",
          });
        }
        return;
      }
      if (collector.includeBound && !collector.seen.has("mode")) {
        collector.seen.add("mode");
        const available = effect.modes.filter((mode) =>
          mode.effect.op !== "requires" ? true : evaluateCondition(collector.ctx, mode.effect.condition),
        );
        collector.specs.push({
          key: "mode",
          kind: "choose-mode",
          min: 1,
          max: 1,
          targeted: false,
          options: available.map((mode) => ({ id: mode.id, ...(mode.label ? { label: mode.label } : {}) })),
          rule: "355.3",
        });
      }
      for (const mode of effect.modes) if (modes.includes(mode.id)) walk(collector, mode.effect);
      return;
    }
    case "requires":
      collector.requires.push({ condition: effect.condition, ...(effect.rule ? { rule: effect.rule } : {}) });
      walk(collector, effect.effect);
      return;
    case "deal_split":
      addSplitTargets(collector, effect);
      return;
    case "cost_then":
      // 355.10.c / 355.10.c.1: costs within instructions do not target.
      walk(collector, effect.effect);
      return;
    case "continuous": {
      const target = (effect.modifier as { target?: Selector }).target;
      addSelector(collector, target);
      return;
    }
    case "look":
    case "search":
    case "reflexive":
    case "delayed":
    case "choose":
    case "custom":
      return;
    default:
      scanOp(collector, effect);
  }
}

function collect(room: Room, host: RulesHost, ability: Ability, ctx: ChoiceContext, includeBound: boolean): Collector {
  const collector: Collector = {
    specs: [],
    seen: new Set(),
    includeBound,
    ctx: evalContext(room, host, ctx),
    requires: [],
    groups: new Map(),
  };
  const effect = abilityEffect(ability);
  if (effect) walk(collector, effect);
  return collector;
}

/** Rule order: mode first (355.3), then targets/zones/players (355.4–355.7), then X. */
function ordered(specs: ChoiceSpec[]): ChoiceSpec[] {
  const rank = (spec: ChoiceSpec) => (spec.key === "mode" ? 0 : spec.key === "x" ? 2 : 1);
  return specs
    .map((spec, index) => ({ spec, index }))
    .sort((a, b) => rank(a.spec) - rank(b.spec) || a.index - b.index)
    .map((entry) => entry.spec);
}

export function requiredChoices(
  room: Room,
  host: RulesHost,
  ability: Ability,
  ctx: ChoiceContext,
): ChoiceSpec[] {
  const specs = ordered(collect(room, host, ability, ctx, false).specs);
  // 355.3: targets inside modes are only known once the mode is chosen.
  const mode = specs.find((spec) => spec.key === "mode");
  return mode ? [mode] : specs;
}

export function validateChoices(
  room: Room,
  host: RulesHost,
  ability: Ability,
  ctx: ChoiceContext,
): Verdict {
  const collector = collect(room, host, ability, ctx, true);
  // 377.2.b: "Use/play this only while …" must hold to play or activate it.
  for (const entry of collector.requires) {
    if (!evaluateCondition(collector.ctx, entry.condition)) return fail("illegal_action", entry.rule ?? "377.2.b");
  }
  for (const spec of ordered(collector.specs)) {
    const value = ctx.choices?.[spec.key];
    if (value === undefined || value === null) {
      // 355.8 / 403.3: a required choice with no legal option cannot be made.
      if (spec.min > 0 && spec.options.length === 0) return fail("no_legal_targets", "355.8", spec.key);
      if (spec.min > 0) return fail("invalid_choice", "355.8", `missing ${spec.key}`);
      continue;
    }
    const offered = new Set(spec.options.map((option) => option.id));
    if (spec.key === "x") {
      const number = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(number) || number < 0) return fail("invalid_choice", "355.1", "x");
      continue;
    }
    const ids = idsOf(value);
    if (ids.length < Math.min(spec.min, spec.options.length) || ids.length > spec.max) {
      return fail("invalid_choice", spec.rule, spec.key);
    }
    for (const id of ids) {
      if (!offered.has(id)) return fail(spec.targeted ? "illegal_target" : "invalid_choice", spec.targeted ? "355.9" : spec.rule, `${spec.key}:${id}`);
    }
    // 355.14.c / 355.11: a split/group choice names each object once.
    const group = collector.groups.get(spec.key);
    if ((group || spec.data?.split) && new Set(ids).size !== ids.length) {
      return fail("invalid_choice", spec.rule, `${spec.key}: duplicate`);
    }
    // 355.11.a: the chosen group must collectively fulfill its requirement.
    if (group && !groupSatisfied(collector.ctx, group, ids)) return fail("illegal_target", "355.11.a", spec.key);
  }
  return { ok: true };
}

/** 355.14.c / 715.3: the damage a `deal_split` distributes (Bonus Damage included), or null. */
export function splitTotal(ctx: EvalContext, effect: Extract<Effect, { op: "deal_split" }>): number | null {
  const amount = evaluateAmount(ctx, effect.amount);
  if (amount === null) return null;
  const base = Math.trunc(amount);
  if (base < 1) return base;
  const sources = effect.source ? resolveSelector(ctx, effect.source) : [];
  const sourceId = sources[0] ?? ctx.env.sourceObjectId;
  return (
    base +
    bonusDamage(ctx.room, ctx.host, {
      controller: ctx.env.controller,
      ...(sourceId ? { sourceObjectId: sourceId } : {}),
      kind: ctx.env.kind ?? inferAbilityKind(ctx),
    })
  );
}

/** The kind of the item being played/resolved (spell vs ability) for Bonus Damage (713). */
function inferAbilityKind(ctx: EvalContext): string {
  const item = ctx.env.itemId ? ctx.room.rules?.chain.find((entry) => entry.id === ctx.env.itemId) : undefined;
  if (item) return item.kind === "activated" ? "activated" : item.kind === "triggered" ? "triggered" : "spell";
  const source = ctx.env.sourceObjectId;
  const type = source ? (ctx.host.cardInfo(ctx.room, source)?.type ?? "").toLowerCase() : "";
  return type.includes("spell") ? "spell" : "activated";
}
