/** Teemo, Scout (OGN-197) — "[HIDDEN] When you play me, give me +3 [Might] this turn." ([Hidden] 811 is the play layer's) */
import { registerCardScript } from "../registry";
import { SELF, WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Teemo, Scout",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, give me +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: SELF },
    },
  ],
});
