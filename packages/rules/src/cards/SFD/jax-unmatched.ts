/** Jax, Unmatched. */
import { notIntrinsic, registerCardScript } from "../sdk";
import { EQUIPMENT } from "./custom";

registerCardScript({
  name: "Jax, Unmatched",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nYour Equipment everywhere have [Quick-Draw]. (Each gains [Reaction]. When you play it, attach it to a unit you control.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Quick-Draw",
        target: { ...EQUIPMENT, controller: "self" },
      },
    },
    ...notIntrinsic("Reaction"),
  ],
});
