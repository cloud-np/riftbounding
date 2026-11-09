/** Lord Broadmane. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { OTHER_FRIENDLY_HERE } from "./custom";

registerCardScript({
  name: "Lord Broadmane",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, give your other units here [Assault] this turn. (+1 [Might] while they're attackers.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Assault" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "grant_keyword",
        keyword: "Assault",
        target: { ...OTHER_FRIENDLY_HERE },
        duration: "this-turn",
      },
    },
  ],
});
