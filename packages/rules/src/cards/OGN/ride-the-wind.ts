/** Ride the Wind (OGN-173 — EX[103]/EX[114] (359.3.e.6, 359.3.e.14.b): a negated move does not stop the ready.) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Ride the Wind",
  text: "[Action] (play on your turn or in showdowns.) \n\nMove a friendly unit and ready it.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "self", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          { op: "ready", target: { targetRef: "target:0" } },
        ],
      },
    },
  ],
});
