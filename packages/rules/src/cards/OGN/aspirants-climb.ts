/**
 * Aspirant's Climb (OGN-276, battlefield) — "Increase the points needed to win the game by 1."
 *
 * Exposed as a `victory-score` modifier (`victoryScoreAdjustment` sums them). The engine host's
 * Victory Score (`RulesHost.victoryScore` / `settleVictory`, `rules/victory.ts`) adds 1 for each
 * Aspirant's Climb in play (194.3.a), so the cleanup victory check and the Final Point threshold
 * (473.1.b) both use the raised score.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Aspirant's Climb",
  text: "Increase the points needed to win the game by 1.",
  status: "implemented",
  abilities: [{ kind: "passive", modifier: { kind: "victory-score", amount: 1 } }],
});
