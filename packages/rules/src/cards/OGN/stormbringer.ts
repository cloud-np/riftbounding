/**
 * Stormbringer (OGN-250) — "Choose a friendly unit in your base. Deal damage equal to its Might to
 * all enemy units at a battlefield, then move your unit there."
 *
 * The friendly unit and the battlefield are chosen when playing (355.7). The spell deals the damage
 * (418.6.a) equal to the unit's Might on resolution to every enemy unit at that battlefield, then
 * the unit moves there (421; 451.2 / restrictions may stop the move).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

const THERE = { kind: "chosen", ref: "target:1" } as const;

registerCardScript({
  name: "Stormbringer",
  text: "Choose a friendly unit in your base. Deal damage equal to its Might to all enemy units at a battlefield, then move your unit there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", zone: "base", targetRef: "target:0" }),
        effect: {
          op: "for_each",
          selector: { chosen: true, cardType: "battlefield", targetRef: "target:1" },
          effect: {
            op: "seq",
            effects: [
              {
                op: "deal",
                amount: { kind: "might", selector: { targetRef: "target:0" } },
                target: { cardType: "unit", controller: "opponent", zone: THERE },
              },
              { op: "move", target: { targetRef: "target:0" }, to: THERE },
            ],
          },
        },
      },
    },
  ],
});
