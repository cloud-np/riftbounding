/** Magma Wurm (OGN-011) — "Other friendly units enter ready." (369.3 enter-ready replacement, EX[134]) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Magma Wurm",
  text: "Other friendly units enter ready.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "custom",
        id: "enter-ready",
        params: { target: { cardType: "unit", excludeSource: true } },
      },
    },
  ],
});
