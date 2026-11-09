/**
 * Ahri, Inquisitive (OGN-119) — "When I attack or defend, give an enemy unit here -2 [Might] this
 * turn, to a minimum of 1 [Might]." (383.4.e/f; 479.4.b: the minimum is snapshotted on resolution)
 */
import { aUnit, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ahri, Inquisitive",
  text: "When I attack or defend, give an enemy unit here -2 [Might] this turn, to a minimum of 1 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["attack", "defend"], subject: SELF } },
      effect: {
        op: "give_might",
        amount: -2,
        min: 1,
        target: aUnit({ controller: "opponent", zone: HERE }),
      },
    },
  ],
});
