/** Retreat (OGN-104 — EX[166] (383.2.c.3.b)) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Retreat",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nReturn a friendly unit to its owner's hand. Its owner channels 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          { op: "channel", amount: 1, exhausted: true, player: { kind: "owner", of: { targetRef: "target:0" } } },
        ],
      },
    },
  ],
});
