/**
 * Creating layer effects — draft-only mutators used by effect ops (479.3/479.4, 438, 801.3,
 * 391.4).
 *
 * - "this turn" Might on one object → `objects.temporaryMight` (R1 field, cleared in 3d);
 * - other durations → `objects.mightMods` / `objects.keywordGrants` (cleared when the object
 *   leaves the board, or lazily when the duration ends);
 * - selector-based / player-level effects → `rules.effects` (`ContinuousEffect`).
 *
 * Every function emits nothing itself; the calling op emits the `GameEvent`.
 */
import type { ContinuousEffect, EffectDuration, Modifier, Room } from "@rift/protocol";
import type { RulesHost } from "../host";

function turnOf(room: Room): number {
  return room.rules?.turn.number ?? 0;
}

/** 479.4: give `amount` Might to one object for `duration`. */
export function addMight(
  room: Room,
  host: RulesHost,
  objectId: string,
  amount: number,
  duration: EffectDuration,
  controller: string,
  sourceObjectId?: string,
): void {
  const rules = room.rules;
  if (!rules || amount === 0) return;
  const object = (rules.objects[objectId] ??= {});
  if (duration === "this-turn" || duration === "until-next-ending") {
    object.temporaryMight = (object.temporaryMight ?? 0) + amount;
    return;
  }
  (object.mightMods ??= []).push({
    id: host.nextId("mod"),
    amount,
    duration,
    turn: turnOf(room),
    controller,
    ...(sourceObjectId ? { sourceObjectId } : {}),
  });
}

/** 801.3.a / 801.3.b: grant (or remove) a keyword on one object for `duration`. */
export function addKeywordGrant(
  room: Room,
  host: RulesHost,
  objectId: string,
  keyword: string,
  duration: EffectDuration,
  controller: string,
  options: { value?: number; removed?: boolean; sourceObjectId?: string } = {},
): void {
  const rules = room.rules;
  if (!rules) return;
  const object = (rules.objects[objectId] ??= {});
  (object.keywordGrants ??= []).push({
    id: host.nextId("kw"),
    keyword,
    duration,
    turn: turnOf(room),
    controller,
    ...(options.value !== undefined ? { value: options.value } : {}),
    ...(options.removed ? { removed: true } : {}),
    ...(options.sourceObjectId ? { sourceObjectId: options.sourceObjectId } : {}),
  });
}

/** 438: add a prevention shield (`value` "all" never decreases). */
export function addPreventShield(
  room: Room,
  host: RulesHost,
  objectId: string,
  value: number | "all",
  duration: EffectDuration,
  controller: string,
  sourceObjectId?: string,
): void {
  const rules = room.rules;
  if (!rules) return;
  const object = (rules.objects[objectId] ??= {});
  (object.prevent ??= []).push({
    id: host.nextId("prevent"),
    value,
    duration,
    turn: turnOf(room),
    controller,
    ...(sourceObjectId ? { sourceObjectId } : {}),
  });
}

/**
 * Turn number after which a continuous effect stops (see `durations.ts`): this-turn /
 * this-combat → the current turn; until-your-next-turn → the turn before the controller's next
 * turn in Turn Order (734 additional turns are not modelled); permanent/while → none.
 */
export function expiryTurn(room: Room, host: RulesHost, duration: EffectDuration, controller: string): number | undefined {
  const rules = room.rules;
  if (!rules) return undefined;
  const now = rules.turn.number;
  if (duration === "this-turn" || duration === "until-next-ending" || duration === "this-combat") return now;
  if (duration === "until-your-next-turn") {
    const order = host.turnOrder(room);
    const current = order.indexOf(rules.turn.player);
    const mine = order.indexOf(controller);
    if (current < 0 || mine < 0) return now;
    const distance = (mine - current + order.length) % order.length || order.length;
    return now + distance - 1;
  }
  return undefined;
}

/** 391.4 / 475: add a continuous effect; returns its id. */
export function addContinuousEffect(
  room: Room,
  host: RulesHost,
  input: {
    controller: string;
    duration: EffectDuration;
    modifier: Modifier;
    sourceObjectId?: string;
    condition?: ContinuousEffect["condition"];
    label?: string;
  },
): string | null {
  const rules = room.rules;
  if (!rules) return null;
  const id = `fx-${host.nextId("effect")}`;
  const expires = expiryTurn(room, host, input.duration, input.controller);
  rules.effects.push({
    id,
    controller: input.controller,
    duration: input.duration,
    modifier: input.modifier,
    ...(input.sourceObjectId ? { sourceObjectId: input.sourceObjectId } : {}),
    ...(expires !== undefined ? { expiresAtTurn: expires } : {}),
    ...(input.condition ? { condition: input.condition } : {}),
    ...(input.label ? { label: input.label } : {}),
  });
  return id;
}

/**
 * Drop per-object entries whose duration ended (called from the effects cleanup hook): "this
 * turn" entries at the Expiration Step, "this combat" entries once no combat is in progress.
 */
export function pruneObjectMods(room: Room, options: { endOfTurn: boolean }): void {
  const rules = room.rules;
  if (!rules) return;
  const now = rules.turn.number;
  const keep = (entry: { duration: EffectDuration; turn: number }) => {
    if (entry.duration === "this-combat") return rules.combat !== null && entry.turn === now;
    if (entry.duration === "this-turn" || entry.duration === "until-next-ending") {
      return !options.endOfTurn && entry.turn === now;
    }
    return true;
  };
  const onChain = new Set(rules.chain.map((item) => item.id));
  for (const object of Object.values(rules.objects)) {
    if (object.targetedBy) {
      object.targetedBy = object.targetedBy.filter((itemId) => onChain.has(itemId));
      if (object.targetedBy.length === 0) delete object.targetedBy;
    }
    if (object.mightMods) {
      object.mightMods = object.mightMods.filter(keep);
      if (object.mightMods.length === 0) delete object.mightMods;
    }
    if (object.keywordGrants) {
      object.keywordGrants = object.keywordGrants.filter(keep);
      if (object.keywordGrants.length === 0) delete object.keywordGrants;
    }
    if (object.prevent) {
      object.prevent = object.prevent.filter(keep);
      if (object.prevent.length === 0) delete object.prevent;
    }
  }
  rules.effects = rules.effects.filter((effect) => {
    if (effect.duration === "this-combat") return rules.combat !== null && (effect.expiresAtTurn ?? now) === now;
    if (effect.expiresAtTurn !== undefined && now > effect.expiresAtTurn) return false;
    return true;
  });
}
