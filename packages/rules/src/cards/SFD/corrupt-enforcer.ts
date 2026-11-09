/** Corrupt Enforcer. */
import { registerCardScript } from "../sdk";
import { WHEN_I_MOVE_TO_BATTLEFIELD, WHEN_I_WIN_A_COMBAT } from "./custom";

registerCardScript({
  name: "Corrupt Enforcer",
  text: "When I move to a battlefield, discard 1.\nWhen I win a combat, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: { op: "discard", amount: 1 },
    },
    { kind: "triggered", trigger: WHEN_I_WIN_A_COMBAT, effect: { op: "draw", amount: 1 } },
  ],
});
