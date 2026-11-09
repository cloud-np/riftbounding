/** Switcheroo. */
import { registerCardScript } from "../sdk";
import { target } from "./custom";

registerCardScript({
  name: "Switcheroo",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nSwap the Might of two units at the same battlefield this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "swap",
        property: "might",
        a: target({ zone: "battlefield", targetRef: "target:0" }),
        b: target({
          zone: "battlefield",
          targetRef: "target:1",
          sameLocationAs: "target:0",
          excludeRefs: ["target:0"],
        }),
      },
    },
  ],
});
