/** Riposte. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Riposte",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nChoose a friendly unit and a spell. Counter that spell and give that unit +[Might] equal to that spell's energy cost this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          // The two Targets (355.7); the instruction reads the spell's Energy cost before countering it.
          {
            op: "for_each",
            selector: target({ controller: "self", targetRef: "target:0" }),
            effect: {
              op: "for_each",
              selector: { chosen: true, cardType: "spell", targetRef: "target:1" },
              effect: {
                op: "custom",
                id: "sfd:counter-and-give-cost",
                params: { spell: "target:1", unit: "target:0" },
              },
            },
          },
        ],
      },
    },
  ],
});
