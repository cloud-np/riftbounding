/** Blood Money. */
import { custom, registerCardScript } from "../sdk";
import { gold, target } from "./custom";

registerCardScript({
  name: "Blood Money",
  text: "[Action] (Play on your turn or in showdowns.)\nKill a unit at a battlefield with 2 [Might] or less. If it was an enemy unit, play a Gold gear token exhausted. If it was a friendly unit, play two Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: target({
              zone: "battlefield",
              might: { op: "lte", value: 2 },
              targetRef: "target:0",
            }),
          },
          {
            op: "if",
            condition: custom("sfd:ref-was-friendly", { ref: "target:0", friendly: false }),
            then: gold(),
          },
          {
            op: "if",
            condition: custom("sfd:ref-was-friendly", { ref: "target:0", friendly: true }),
            then: gold(2),
          },
        ],
      },
    },
  ],
});
