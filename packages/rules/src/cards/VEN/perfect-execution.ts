/** Perfect Execution. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Perfect Execution",
  text: "Ready a unit and give it [Assault 3] this turn. (+3 [Might] while it's an attacker.)\n[Flow][3][Fury] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ targetRef: "target:0" }) },
          {
            op: "grant_keyword",
            keyword: "Assault",
            value: 3,
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
