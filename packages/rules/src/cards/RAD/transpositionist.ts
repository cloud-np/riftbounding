/**
 * Transpositionist (RAD-115) — "[Chaos], [Tap]: Return a friendly unit to its owner's hand. You may
 * play a unit with less Might than that unit had, ignoring its cost." (359.3.e.13 "had")
 */
import { aUnit, registerCardScript, SELF } from "../sdk";
import { letX, PLAY_OP_NOTE } from "./custom";

registerCardScript({
  name: "Transpositionist",
  text: "[Chaos], [Tap]: Return a friendly unit to its owner's hand. You may play a unit with less Might than that unit had, ignoring its cost.",
  status: "partial",
  notes: `The optional play is automated, but ${PLAY_OP_NOTE}.`,
  abilities: [
    {
      kind: "activated",
      cost: { power: { Chaos: 1 }, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          letX(
            { lkiMightOf: "target:0" },
            {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "picked",
                  selector: {
                    zone: "hand",
                    controller: "self",
                    cardType: "unit",
                    might: { op: "lt", value: { kind: "x" } },
                  },
                  min: 0,
                  max: 1,
                },
                { op: "play", target: { targetRef: "picked" }, cost: "ignored" },
              ],
            },
          ),
        ],
      },
    },
  ],
});
