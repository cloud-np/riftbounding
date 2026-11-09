/**
 * Aspirant's Climb (OGN-276, battlefield) — "Increase the points needed to win the game by 1."
 *
 * Exposed as a `victory-score` modifier (`victoryScoreAdjustment` sums them). The Victory Score
 * itself comes from the engine host (`RulesHost.victoryScore`/`settleVictory`, frozen), so the
 * adjustment is not applied yet: R2-combat/the lead must add it where victory is checked.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Aspirant's Climb",
  text: "Increase the points needed to win the game by 1.",
  status: "partial",
  notes: "Victory Score comes from the frozen host; consumers must add victoryScoreAdjustment().",
  abilities: [{ kind: "passive", modifier: { kind: "custom", id: "victory-score", params: { amount: 1 } } }],
});
