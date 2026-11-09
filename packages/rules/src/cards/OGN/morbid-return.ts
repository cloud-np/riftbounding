/** Morbid Return (OGN-170) — "Return a unit from your trash to your hand." (355.7 chosen card in your trash) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Morbid Return",
  text: "[ACTION] (Play on your turn or in showdowns.)\nReturn a unit from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "return_to_hand", target: aUnit({ zone: "trash", owner: "self" }) },
    },
  ],
});
