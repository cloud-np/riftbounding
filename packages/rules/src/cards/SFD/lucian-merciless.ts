/** Lucian, Merciless. */
import { registerCardScript, SELF, WHEN_I_CONQUER } from "../sdk";

registerCardScript({
  name: "Lucian, Merciless",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nThe first time I conquer each turn, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      limit: { kind: "once-per-turn" },
      effect: { op: "ready", target: SELF },
    },
  ],
});
