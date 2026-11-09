/** Rell, Magnetic. */
import { registerCardScript, SELF, WHEN_I_ATTACK } from "../sdk";
import { EQUIPMENT } from "./custom";

registerCardScript({
  name: "Rell, Magnetic",
  text: "[Tank] (I must be assigned combat damage first.)\nWhen I attack, you may play an Equipment with Energy cost no more than [2], ignoring its cost. If you do, then do this: Attach it to me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "equipment",
            selector: {
              ...EQUIPMENT,
              zone: "hand",
              owner: "self",
              energyCost: { op: "lte", value: 2 },
            },
            min: 1,
            max: 1,
          },
          { op: "play", target: { targetRef: "equipment" }, cost: "ignored" },
          {
            op: "if",
            condition: { kind: "did" },
            then: {
              op: "reflexive",
              effect: { op: "attach", gear: { targetRef: "equipment" }, to: SELF },
            },
          },
        ],
      },
    },
  ],
});
