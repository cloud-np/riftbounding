/** Yuumi, Magical Cat. */
import { aUnit, HERE, registerCardScript, WHEN_I_ATTACK_OR_DEFEND } from "../sdk";

registerCardScript({
  name: "Yuumi, Magical Cat",
  text: "When I attack or defend, give one of your other units here +3[Might] and [Tank] this turn. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Tank" },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: 3,
            target: aUnit({
              controller: "self",
              zone: HERE,
              excludeSource: true,
              targetRef: "target:0",
            }),
          },
          {
            op: "grant_keyword",
            keyword: "Tank",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
