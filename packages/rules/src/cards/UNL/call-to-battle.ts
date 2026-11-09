/** Call to Battle. */
import { aUnit, custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Call to Battle",
  text: "Move a unit you control to a battlefield you control. Then, choose an opponent. They move a unit they control to the same battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "battlefield",
          where: custom("unl:battlefield-controlled-by-team"),
        },
        effect: {
          op: "seq",
          effects: [
            {
              op: "move",
              target: aUnit({ controller: "self", targetRef: "target:0" }),
              to: { kind: "chosen", ref: "battlefield" },
            },
            {
              op: "choose",
              key: "theirs",
              selector: { cardType: "unit", controller: "opponent" },
              min: 1,
              max: 1,
              chooser: "opponent",
            },
            {
              op: "move",
              target: { targetRef: "theirs" },
              to: { kind: "chosen", ref: "battlefield" },
            },
          ],
        },
      },
    },
  ],
});
