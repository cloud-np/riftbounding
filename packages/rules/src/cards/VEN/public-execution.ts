/** Public Execution. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Public Execution",
  text: "Choose a friendly unit. Kill an enemy unit with less Might than it.\n[Flow][5][Rune][Rune] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", targetRef: "target:0" }),
        effect: {
          op: "kill",
          target: aUnit({
            controller: "opponent",
            targetRef: "target:1",
            might: { op: "lt", value: { kind: "might", selector: { targetRef: "target:0" } } },
          }),
        },
      },
    },
  ],
});
