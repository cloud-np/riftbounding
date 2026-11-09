/**
 * Shadow Dash (VEN-148) — "Move an enemy unit to a battlefield where you have units. If you have
 * exactly two units there, they each get +1 [Might] this turn. [Flow][5][Rune][Rune]"
 *
 * The destination is a chosen battlefield object with one of your units (355.4); the unit count
 * there is checked on resolution, after the move (359.3.f.2).
 */
import { registerCardScript } from "../registry";
import { aUnit, custom } from "../dsl";
import { FLOW_GAP } from "./shared";

const THERE = { kind: "chosen" as const, ref: "target:0" };

registerCardScript({
  name: "Shadow Dash",
  text: "Move an enemy unit to a battlefield where you have units. If you have exactly two units there, they each get +1[Might] this turn.\n[Flow][5][Rune][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "partial",
  notes: FLOW_GAP,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "target:0",
          where: custom("ven:you-have-units-at-it"),
        },
        effect: {
          op: "seq",
          effects: [
            {
              op: "move",
              target: aUnit({ controller: "opponent", targetRef: "target:1" }),
              to: THERE,
            },
            {
              op: "if",
              condition: {
                kind: "count",
                selector: { cardType: "unit", controller: "self", zone: THERE },
                comparison: { op: "eq", value: 2 },
              },
              then: {
                op: "temporary_might",
                amount: 1,
                target: { cardType: "unit", controller: "self", zone: THERE },
              },
            },
          ],
        },
      },
    },
  ],
});
