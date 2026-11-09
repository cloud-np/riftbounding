/** Lilting Lullaby. */
import { registerCardScript } from "../sdk";
import { A_SPELL } from "./custom";

registerCardScript({
  name: "Lilting Lullaby",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell. Its controller can't play spells this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { ...A_SPELL },
        effect: {
          op: "seq",
          effects: [
            // Read the spell's controller before it leaves the chain.
            { op: "custom", id: "unl:no-spells-this-turn" },
            { op: "counter", target: { targetRef: "it" } },
          ],
        },
      },
    },
  ],
});
