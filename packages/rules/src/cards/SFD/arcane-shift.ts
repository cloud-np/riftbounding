/** Arcane Shift. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Arcane Shift",
  text: "[Action] (Play on your turn or in showdowns.)\nBanish a friendly unit, then its owner plays it, ignoring its cost. Deal 3 to an enemy unit at a battlefield. Banish this.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "sfd:bind", params: { from: "target:0", to: "shifted" } },
          { op: "banish", target: { targetRef: "target:0" } },
          { op: "play", target: { targetRef: "shifted" }, cost: "ignored" },
          {
            op: "deal",
            amount: 3,
            target: aUnit({ controller: "opponent", zone: "battlefield", targetRef: "target:1" }),
          },
          { op: "custom", id: "sfd:banish-this-spell" },
        ],
      },
    },
  ],
});
