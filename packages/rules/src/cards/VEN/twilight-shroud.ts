/** Twilight Shroud. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Twilight Shroud",
  text: "Give a friendly unit +1 [Might] this turn. It can't be chosen by enemy spells and abilities this turn.\n[Flow][2] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 1,
            target: aUnit({ controller: "self", targetRef: "target:0" }),
          },
          {
            // 757.1: frozen to the chosen unit for this turn (391.4 delayed passive).
            op: "continuous",
            duration: "this-turn",
            modifier: {
              kind: "restriction",
              restriction: "be-targeted:enemy",
              target: { targetRef: "target:0" },
            },
          },
        ],
      },
    },
  ],
});
