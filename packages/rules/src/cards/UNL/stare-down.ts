/**
 * Stare Down (UNL-107) — "Choose a friendly unit and a battlefield. Move all enemy units at that
 * battlefield with less Might than the chosen unit to their base. Gain 1 XP." Both choices are
 * targets (355.7): the friendly unit (`target:0`) and a battlefield object (`battlefield`), whose
 * zone the move's selector resolves from the choice (359.3.f). If the unit is no longer a legal
 * target the comparison has no information and the move is ignored (359.3.e.12); the XP is not.
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Stare Down",
  text: "Choose a friendly unit and a battlefield. Move all enemy units at that battlefield with less Might than the chosen unit to their base. Gain 1 XP.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "for_each",
            selector: aUnit({ controller: "self", targetRef: "target:0" }),
            effect: {
              op: "for_each",
              selector: { chosen: true, cardType: "battlefield", targetRef: "battlefield" },
              effect: {
                op: "move",
                target: {
                  cardType: "unit",
                  controller: "opponent",
                  all: true,
                  zone: { kind: "chosen", ref: "battlefield" },
                  might: {
                    op: "lt",
                    value: { kind: "might", selector: { targetRef: "target:0" } },
                  },
                },
                to: "base",
              },
            },
          },
          { op: "gain_xp", amount: 1 },
        ],
      },
    },
  ],
});
