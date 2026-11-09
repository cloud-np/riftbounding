/** Chakram Dancer. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { OTHER_FRIENDLY_HERE } from "./custom";

registerCardScript({
  name: "Chakram Dancer",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, give your other units here [Shield] this turn. (+1 [Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Shield" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "grant_keyword",
        keyword: "Shield",
        target: { ...OTHER_FRIENDLY_HERE },
        duration: "this-turn",
      },
    },
  ],
});
