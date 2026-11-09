/**
 * The Grand Plaza (OGN-293, battlefield) — "When you hold here, if you have 7+ units here, you win
 * the game."
 *
 * 383.2.a.1: the "if" right after the trigger condition is part of it. Registers
 * `ogn-oz:win-game`: the ability's controller wins (195; team mode via `playerWins`).
 */
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops";
import { playerWins } from "../../scoring/concede";
import { registerCardScript } from "../registry";
import { HERE, WHEN_YOU_HOLD_HERE } from "../dsl";

registerCustomEffect("ogn-oz:win-game", (_params, context) => {
  playerWins(context.room, context.machine?.env.controller ?? context.controller, context.step);
  return RESOLVED;
});

registerCardScript({
  name: "The Grand Plaza",
  text: "When you hold here, if you have 7+ units here, you win the game.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      condition: {
        kind: "count",
        selector: { cardType: "unit", controller: "self", zone: HERE },
        comparison: { op: "gte", value: 7 },
      },
      effect: { op: "custom", id: "ogn-oz:win-game" },
    },
  ],
});
