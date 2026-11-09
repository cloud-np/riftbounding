/** Damage / Heal — rules 418–419. */
import type { Room } from "@rift/protocol";
import type { RulesStepContext } from "../types";
import { effectiveMight, pushEvent } from "../types";
import { interceptAction } from "../timing/hooks";

export function dealDamage(
  room: Room,
  cardId: string,
  amount: number,
  step: RulesStepContext,
  source?: {
    objectId?: string;
    cardId?: string;
    /** 142.3.a: the player responsible for the Deal action (marks the damage). */
    playerId?: string;
    /** 467.2.d: combat damage dealt from a 467.2.c assignment. */
    combat?: boolean;
  },
): number {
  const rules = room.rules;
  // 367–375: a replacement effect can change the amount or prevent the damage entirely.
  const proposal = interceptAction(room, step, {
    type: "deal_damage",
    cardId,
    amount: Math.max(0, Math.trunc(amount)),
    ...(source?.objectId ? { objectId: source.objectId } : {}),
    ...(source?.playerId ? { playerId: source.playerId } : {}),
    ...(source?.combat ? { data: { combat: true } } : {}),
  });
  if (!proposal) return 0;
  const damage = Math.max(0, Math.trunc(proposal.amount ?? amount));
  if (!rules || damage <= 0) return 0;
  const located = step.host.findCard(room, cardId);
  if (!located) return 0;
  const object = (rules.objects[cardId] ??= {});
  object.damage = (object.damage ?? 0) + damage;
  object.damagedThisTurn = true;
  // 429.5.c / 429.5.c.1: note who dealt the damage, so a kill caused by this lethal damage in a
  // Cleanup is attributed to the spell/ability (and its controller) that dealt it.
  if (source?.objectId || source?.playerId) {
    object.damageSource = {
      ...(source.objectId ? { objectId: source.objectId } : {}),
      ...(source.playerId ? { playerId: source.playerId } : {}),
    };
  }
  pushEvent(step.events, {
    type: "damage",
    cardId,
    playerId: located.playerId,
    amount: damage,
    ...(source?.objectId ? { sourceObjectId: source.objectId } : {}),
    ...(source?.playerId ? { controllerId: source.playerId } : {}),
    data: {
      damage: object.damage,
      might: effectiveMight(room, cardId, step.host),
      ...(source?.combat ? { combat: true } : {}),
    },
  });
  return damage;
}

/** 419: healing clears marked damage. */
export function heal(room: Room, cardId: string, amount: number, step: RulesStepContext): number {
  const rules = room.rules;
  const proposal = interceptAction(room, step, {
    type: "heal",
    cardId,
    amount: Math.max(0, Math.trunc(amount)),
  });
  if (!proposal) return 0;
  const object = rules?.objects[cardId];
  if (!rules || !object || !object.damage) return 0;
  const healed = Math.min(object.damage, Math.max(0, Math.trunc(proposal.amount ?? amount)));
  if (healed <= 0) return 0;
  object.damage -= healed;
  if (object.damage <= 0) delete object.damage;
  pushEvent(step.events, { type: "heal", cardId, amount: healed });
  return healed;
}
