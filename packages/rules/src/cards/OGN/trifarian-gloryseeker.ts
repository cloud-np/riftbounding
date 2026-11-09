/**
 * Trifarian Gloryseeker (OGN-217) — "[LEGION] When you play me, buff me."
 *
 * Also registers the lane's Legion condition `ogn-oz:legion` (812.1.c / 812.2 / 420.4.b: the
 * dependent ability is active while its controller has Finalized another card this turn, a
 * countered one included) through R2-play's `legionActive`. A Legion triggered ability is
 * Inactive without it (727.1.b), so the condition is the trigger's condition (checked at
 * detection, 383.2.a.1). Other O–Z Legion cards import `LEGION` from here.
 */
import type { Condition } from "@rift/protocol";
import { registerCustomCondition } from "../../effects/evaluate";
import { legionActive } from "../../play/keyword-helpers";
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED, custom } from "../dsl";

registerCustomCondition("ogn-oz:legion", (ctx) =>
  legionActive(ctx.room, ctx.env.controller, ctx.env.sourceObjectId),
);

/** [Legion] (812): another card was Finalized by the controller this turn. */
export const LEGION: Condition = custom("ogn-oz:legion");

registerCardScript({
  name: "Trifarian Gloryseeker",
  text: "[LEGION] When you play me, buff me. (If I don't have a buff, I get a +1 [Might] buff. Get the effect if you've played another card this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: LEGION,
      keywords: ["Legion"],
      effect: { op: "buff", target: SELF },
    },
  ],
});
