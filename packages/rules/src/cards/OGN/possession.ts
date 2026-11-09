/**
 * Possession (OGN-203) — "[ACTION] Choose an enemy unit at a battlefield. Take control of it and
 * recall it."
 *
 * Uses `core:take-control` (cards/lib): the ability's controller gains control of the referenced units
 * (no duration: it lasts while the object stays on the board). The target is chosen when playing
 * (355.7, checked again on resolution, 359.3.e); after the control change it is recalled to its new
 * controller's base (456–460: not a move).
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Possession",
  text: "[ACTION] (Play on your turn or in showdowns.)\nChoose an enemy unit at a battlefield. Take control of it and recall it. (Send it to your base. This isn't a move.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent", zone: "battlefield" }),
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "core:take-control", params: { target: { targetRef: "it" } } },
            { op: "recall", target: { targetRef: "it" } },
          ],
        },
      },
    },
  ],
});
