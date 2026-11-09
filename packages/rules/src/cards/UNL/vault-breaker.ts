/** Vault Breaker. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Vault Breaker",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit [Assault 2] and [Ganking] this turn. (+2 [Might] while it's an attacker. It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Assault",
            value: 2,
            target: aUnit({ targetRef: "target:0" }),
            duration: "this-turn",
          },
          {
            op: "grant_keyword",
            keyword: "Ganking",
            target: { targetRef: "target:0" },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});
