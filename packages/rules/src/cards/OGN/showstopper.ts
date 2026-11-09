/**
 * Showstopper (OGN-270) — "Buff a friendly unit in your base, then move it to a battlefield."
 *
 * The unit and the destination are chosen when playing (355.7 / 355.4); the unit is buffed
 * (427.1.b) then moved (421; 451.2 and restrictions may stop the move). Choosing the base as the
 * destination does nothing (355.4.a).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Showstopper",
  text: "Buff a friendly unit in your base, then move it to a battlefield. (If it doesn't have a buff, it gets a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "buff",
            target: aUnit({ controller: "self", zone: "base", targetRef: "target:0" }),
          },
          {
            op: "move",
            target: { targetRef: "target:0" },
            to: { kind: "chosen", ref: "destination" },
          },
        ],
      },
    },
  ],
});
