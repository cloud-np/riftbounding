/** Arena Bar (OGN-124) — "[Tap]: Buff an exhausted friendly unit." (376–381; 427/702) */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Arena Bar",
  text: "[Tap]: Buff an exhausted friendly unit. (if it doesn't have a buff, it gets a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "buff", target: aUnit({ controller: "self", exhausted: true }) },
    },
  ],
});
