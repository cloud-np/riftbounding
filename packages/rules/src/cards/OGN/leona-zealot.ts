/**
 * Leona, Zealot (OGN-079) — "If an opponent's score is within 3 points of the Victory Score, I
 * enter ready. Stunned enemy units here have -8 [Might], to a minimum of 1 [Might]."
 *
 * The first ability is a conditional enter-ready replacement (369.3). The second is a passive with
 * a "to a minimum of" limitation, which is applied continuously for passives (479.4.b only
 * snapshots non-passive effects); the layers have no per-object minimum for passive Might.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { opponentsOf, registerCustomCondition } from "../../effects/evaluate";

/**
 * An opponent's score is within `n` points of the Victory Score (472). Like every other Victory
 * Score comparison in the engine it reads the host's Victory Score; `victoryScoreAdjustment` is
 * not added because it collects the very layers that evaluate this condition (478.1.c loop).
 */
registerCustomCondition("ogn-an:opponent-near-victory", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 3;
  const victory = ctx.host.victoryScore(ctx.room);
  return opponentsOf(ctx.room, ctx.host, ctx.env.controller).some(
    (id) => victory - ctx.host.score(ctx.room, id) <= n,
  );
});

export const OPPONENT_WITHIN_3: Condition = {
  kind: "custom",
  id: "ogn-an:opponent-near-victory",
  params: { n: 3 },
};

registerCardScript({
  name: "Leona, Zealot",
  text: "If an opponent's score is within 3 points of the Victory Score, I enter ready.\nStunned enemy units here have -8 [Might], to a minimum of 1 [Might].",
  status: "partial",
  notes:
    'Not automated: "Stunned enemy units here have -8 [Might], to a minimum of 1" — the layers have no continuous per-object minimum for a passive Might modifier (479.4.b applies to passives continuously).',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "while", condition: OPPONENT_WITHIN_3, modifier: { kind: "enter-ready", target: SELF } },
    },
  ],
});
