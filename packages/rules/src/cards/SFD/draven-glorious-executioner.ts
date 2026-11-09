/** Draven, Glorious Executioner. */
import type { Trigger } from "@rift/protocol";
import { custom, registerCardScript } from "../sdk";

/** "When you win a combat" (468.3). */
const WHEN_YOU_WIN_A_COMBAT: Trigger = {
  kind: "event",
  event: { type: "combat_result", condition: custom("sfd:you-won-combat") },
};

registerCardScript({
  name: "Draven, Glorious Executioner",
  text: "When you win a combat, draw 1. (You win if only your units remain after combat.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_YOU_WIN_A_COMBAT, effect: { op: "draw", amount: 1 } },
  ],
});
