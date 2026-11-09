/** Not So Fast. */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Not So Fast",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nCounter an enemy spell or ability that chooses a friendly unit or gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "counter",
        target: {
          chosen: true,
          zone: "chain",
          controller: "opponent",
          where: custom("sfd:chooses-friendly"),
        },
      },
    },
  ],
});
