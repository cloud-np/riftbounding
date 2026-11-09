/** Poppy, Keeper of the Hammer. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Poppy, Keeper of the Hammer",
  text: "When you hold, gain 1 XP.\nSpend 3 XP, [Tap]: Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", player: "self" } },
      effect: { op: "gain_xp", amount: 1 },
    },
    { kind: "activated", cost: { spendXp: 3, exhaust: SELF }, effect: { op: "draw", amount: 1 } },
  ],
});
