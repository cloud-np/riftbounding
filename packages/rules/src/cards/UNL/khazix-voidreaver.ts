/**
 * Kha'Zix, Voidreaver (UNL-201, legend) — "When you win a combat, gain 1 XP." (468.3: the
 * winning player is `combat_result.playerId`); "Spend 1 XP, [Tap]: [Buff] a unit." and "Spend 2
 * XP, [Tap]: Move an exhausted friendly unit from a battlefield to its base." (377, 730.2, 421).
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Kha'Zix, Voidreaver",
  text: "When you win a combat, gain 1 XP.\nSpend 1 XP, [tap]: [Buff] a unit.\nSpend 2 XP, [tap]: Move and exhausted friendly unit from a battlefield to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "combat_result", player: "self" } },
      effect: { op: "gain_xp", amount: 1 },
    },
    {
      kind: "activated",
      cost: { spendXp: 1, exhaust: SELF },
      effect: { op: "buff", target: aUnit() },
    },
    {
      kind: "activated",
      cost: { spendXp: 2, exhaust: SELF },
      effect: {
        op: "move",
        target: aUnit({ controller: "self", zone: "battlefield", exhausted: true }),
        to: "base",
      },
    },
  ],
});
