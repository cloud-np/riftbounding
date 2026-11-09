/** The Ball. */
import type { Effect } from "@rift/protocol";
import { HERE, registerCardScript, WHEN_I_MOVE, WHEN_PLAYED } from "../sdk";

/**
 * The Ball (RAD-146) — "[Deploy] [Ganking] When you play or move this, choose one — • Draw 1.
 * • Deal 2 to enemy units here." (355.3 / 403.2: the mode is chosen when the trigger finalizes)
 */
const BALL_MODES: Effect = {
  op: "choose_mode",
  modes: [
    { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
    {
      id: "deal",
      label: "Deal 2 to enemy units here",
      effect: {
        op: "deal",
        amount: 2,
        target: { cardType: "unit", controller: "opponent", zone: HERE },
      },
    },
  ],
};

registerCardScript({
  name: "The Ball",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\n[Ganking] (While this is a unit, it can move from battlefield to battlefield.)\nWhen you play or move this, choose one —\n• Draw 1.\n• Deal 2 to enemy units here.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: BALL_MODES },
    { kind: "triggered", trigger: WHEN_I_MOVE, effect: BALL_MODES },
  ],
});
