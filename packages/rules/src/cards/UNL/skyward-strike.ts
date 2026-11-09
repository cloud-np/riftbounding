/** Skyward Strike. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Skyward Strike",
  text: "Move an enemy unit.\n[Level 6] [Stun] an enemy unit. (While you have 6+ XP, get the effect. A stunned unit doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "The [Level 6] stun target is chosen on play as 'up to one' enemy unit: the choice walker collects both branches of a Level-gated instruction, so it cannot require the choice only while you have 6+ XP (824, 355.7).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "if",
            condition: { kind: "xp-at-least", amount: 6 },
            then: {
              op: "stun",
              target: aUnit({ controller: "opponent", targetRef: "target:1", maxCount: 1 }),
            },
          },
        ],
      },
    },
  ],
});
