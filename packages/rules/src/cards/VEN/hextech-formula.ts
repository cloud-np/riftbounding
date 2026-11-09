/** Hextech Formula (VEN-062, gear) — "This enters exhausted. [Tap]: Empower another gear." (442) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { ENTERS_EXHAUSTED_GAP } from "./shared";

registerCardScript({
  name: "Hextech Formula",
  text: "This enters exhausted.\n[Tap]: Empower another gear. (It becomes Empowered if it's not already.)",
  status: "partial",
  notes: ENTERS_EXHAUSTED_GAP,
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "empower", target: { chosen: true, cardType: "gear", excludeSource: true } },
    },
  ],
});
