/**
 * Demacian Standard (RAD-156) — "[Deploy] When one or more friendly units attack here, give one of
 * them +2 [Might] this turn. When you hold here, you may return this to its owner's hand."
 * "One or more friendly units attack here" is the player-level attack event (383.4.e, 466.2.c.3).
 */
import { aUnit, custom, HERE, registerCardScript, SELF, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Demacian Standard",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen one or more friendly units attack here, give one of them +2 [Might] this turn.\nWhen you hold here, you may return this to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "attack", zone: HERE, player: "self", data: { player: true } },
      },
      effect: {
        op: "temporary_might",
        amount: 2,
        target: aUnit({ controller: "self", zone: HERE, where: custom("rad:is-attacker") }),
      },
    },
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "may", effect: { op: "return_to_hand", target: SELF } },
    },
  ],
});
