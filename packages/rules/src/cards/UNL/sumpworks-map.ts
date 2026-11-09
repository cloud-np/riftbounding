/** Sumpworks Map. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sumpworks Map",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nWhen an opponent scores, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "score", player: "opponent" } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
