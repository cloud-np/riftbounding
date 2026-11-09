/** Lee Sin, Blind Monk (OGN-257, legend) — "[1], [Tap]: Buff a friendly unit." (376–381; 427/702) */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Lee Sin, Blind Monk",
  text: "[1], [Tap]: Buff a friendly unit. (If it doesn't have a buff, it gets a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
