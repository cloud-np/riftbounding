/**
 * Trigger queue — rules 382+, 303.2.a, 383.3.d / 383.3.d.1, 466.2.d, 466.2.d.1.
 *
 * Owner: R2-effects. Consumer: R2-combat (466.2.d / 466.2.d.1).
 * Semantics: adds every `PendingTrigger` in `rules.triggers` to the chain. `opts.order` is the
 * player order to place them in (default: Turn Order starting with the Turn Player, 303.2.a /
 * 383.3.d.1, during a combat too). R2-combat passes `[attacker, ...non-defender players in Turn
 * Order, defender]` once, for the Combat Chain (466.2.d.1). Returns the number of chain items
 * added.
 *
 * Before flushing, triggers for events emitted so far in this step are detected, so a caller
 * that just emitted events (e.g. combat designations) finds them queued. 383.3.d: a player with
 * two or more simultaneous triggers orders them through an `effects.order_triggers` prompt; the
 * remaining players' triggers wait in `rules.triggers` and are flushed (in the same order) after
 * the answer. Placed triggers are Pending Items (402.1) finalized by HOT FEPR (403, see
 * `triggers/finalize.ts`).
 *
 * Signature is a cross-agent contract: keep it stable.
 */
import type { ChainItem, Effect, PendingTrigger, Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { pushEvent } from "../types";
import { appendChainItem } from "../timing/fepr/chain";
import { playersInTurnOrder } from "../effects/evaluate";
import { EFFECTS_PROMPT_REASONS } from "../prompts/effects/reasons";
import { collectTriggers } from "./detect";
import { keywordTrigger } from "./keywords";

/**
 * 303.2.a / 383.3.d.1: simultaneous triggers are placed in Turn Order from the Turn Player —
 * also during a combat. The Attacker-first order of 466.2.d.1 applies only to the Combat Chain
 * (triggers made Pending by beginning the combat and establishing Attacker and Defender); R2-combat
 * passes it explicitly from `beginCombat` (`combatTriggerOrder`), and a 383.3.d ordering prompt
 * carries it on to the players who place after the prompt is answered.
 */
function defaultOrder(room: Room, step: RulesStepContext): string[] {
  return playersInTurnOrder(room, step.host);
}

/** Inline effect + options for keyword / delayed triggers (refs `keyword:*`, `delayed:*`). */
function inlineAbility(
  room: Room,
  trigger: PendingTrigger,
): { effect?: Effect; optional?: boolean; choices?: Record<string, unknown>; consumeEffectId?: string } {
  const ref = trigger.abilityRef ?? "";
  if (ref.startsWith("keyword:")) {
    const [, keyword, raw] = ref.split(":");
    const def = keyword ? keywordTrigger(keyword) : undefined;
    if (!def) return {};
    return { effect: def.effect(Math.max(1, Number(raw) || 1)) };
  }
  if (ref.startsWith("delayed:")) {
    const id = ref.slice("delayed:".length);
    const effect = room.rules?.effects.find((entry) => entry.id === id);
    if (!effect || effect.modifier.kind !== "custom") return {};
    const params = effect.modifier.params ?? {};
    return {
      effect: params.effect as Effect,
      ...(params.optional ? { optional: true } : {}),
      ...(params.choices ? { choices: params.choices as Record<string, unknown> } : {}),
      ...(params.once !== false ? { consumeEffectId: id } : {}),
    };
  }
  return {};
}

/** 402.1: put one pending trigger on the chain as a Pending Item. */
export function placeTrigger(room: Room, step: RulesStepContext, trigger: PendingTrigger): ChainItem | null {
  const rules = room.rules;
  if (!rules) return null;
  const inline = inlineAbility(room, trigger);
  if ((trigger.abilityRef ?? "").startsWith("delayed:") && !inline.effect) return null;
  const item: ChainItem = {
    id: step.host.nextId("chain"),
    kind: "triggered",
    status: "pending",
    controller: trigger.controller,
    ...(trigger.sourceObjectId ? { sourceObjectId: trigger.sourceObjectId } : {}),
    ...(trigger.sourceName ? { cardName: trigger.sourceName, sourceName: trigger.sourceName } : {}),
    ...(trigger.abilityRef ? { abilityRef: trigger.abilityRef } : {}),
    choices: JSON.parse(JSON.stringify(inline.choices ?? {})) as ChainItem["choices"],
    origin: "trigger",
    ...(inline.effect ? { effect: inline.effect } : {}),
    ...(trigger.optional || inline.optional ? { optional: true } : {}),
    ...(trigger.event ? { triggerEvent: trigger.event } : {}),
    addedAt: step.host.now(),
  };
  if (inline.consumeEffectId) {
    // 392: a "next time" delayed trigger is used up when it triggers.
    rules.effects = rules.effects.filter((entry) => entry.id !== inline.consumeEffectId);
  }
  appendChainItem(room, item, step);
  return item;
}

function openOrderPrompt(
  room: Room,
  step: RulesStepContext,
  playerId: string,
  triggers: PendingTrigger[],
  order: readonly string[],
): void {
  const rules = room.rules;
  if (!rules) return;
  rules.prompt = {
    id: step.host.nextId("prompt"),
    kind: "order",
    playerId,
    promptKey: "rules.prompt.orderTriggers",
    rule: "383.3.d",
    options: triggers.map((trigger) => ({
      id: trigger.id,
      label: trigger.sourceName ?? trigger.abilityRef ?? "Triggered ability",
      ...(trigger.sourceObjectId ? { objectId: trigger.sourceObjectId } : {}),
    })),
    min: 0,
    max: triggers.length,
    data: { reason: EFFECTS_PROMPT_REASONS.orderTriggers, order: [...order] },
  };
  pushEvent(step.events, { type: "prompt", playerId, data: { kind: "order", reason: EFFECTS_PROMPT_REASONS.orderTriggers } });
}

/**
 * Place `playerId`'s triggers in `orderedIds` order (first placed = resolves last); ids not
 * listed keep their detection order after the listed ones.
 */
export function placeOrdered(room: Room, step: RulesStepContext, playerId: string, orderedIds: readonly string[]): number {
  const rules = room.rules;
  if (!rules) return 0;
  const mine = rules.triggers.filter((trigger) => trigger.controller === playerId);
  const listed = orderedIds
    .map((id) => mine.find((trigger) => trigger.id === id))
    .filter((trigger): trigger is PendingTrigger => !!trigger);
  const rest = mine.filter((trigger) => !listed.includes(trigger));
  const sequence = [...listed, ...rest];
  rules.triggers = rules.triggers.filter((trigger) => trigger.controller !== playerId);
  let added = 0;
  for (const trigger of sequence) if (placeTrigger(room, step, trigger)) added += 1;
  return added;
}

/** Flush with an explicit order; stops (leaving the rest queued) when a player must order. */
export function flushInOrder(room: Room, step: RulesStepContext, order: readonly string[]): number {
  const rules = room.rules;
  if (!rules || rules.prompt) return 0;
  let added = 0;
  const players = [...order];
  for (const id of new Set(rules.triggers.map((trigger) => trigger.controller))) {
    if (!players.includes(id)) players.push(id);
  }
  for (const playerId of players) {
    const mine = rules.triggers.filter((trigger) => trigger.controller === playerId);
    if (mine.length === 0) continue;
    if (mine.length > 1) {
      openOrderPrompt(room, step, playerId, mine, order);
      return added;
    }
    added += placeOrdered(room, step, playerId, [mine[0]!.id]);
  }
  return added;
}

export function flushPendingTriggers(
  room: Room,
  step: RulesStepContext,
  opts?: { order?: readonly string[] },
): number {
  const rules = room.rules;
  if (!rules) return 0;
  collectTriggers(room, step);
  if (rules.triggers.length === 0) return 0;
  return flushInOrder(room, step, opts?.order ?? defaultOrder(room, step));
}

export { collectTriggers, collectPhaseTriggers, triggerSources } from "./detect";
