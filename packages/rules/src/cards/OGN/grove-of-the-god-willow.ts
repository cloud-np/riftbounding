/** Grove of the God-Willow (OGN-280, battlefield) — "When you hold here, draw 1." */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Grove of the God-Willow",
  text: "When you hold here, draw 1.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_YOU_HOLD_HERE, effect: { op: "draw", amount: 1 } },
  ],
});
