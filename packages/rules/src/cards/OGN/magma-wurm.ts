/** Magma Wurm (OGN-011) — "Other friendly units enter ready." (369.3 enter-ready replacement, EX[134]) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Magma Wurm",
  text: "Other friendly units enter ready.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "enter-ready", target: { cardType: "unit", excludeSource: true } },
    },
  ],
});
