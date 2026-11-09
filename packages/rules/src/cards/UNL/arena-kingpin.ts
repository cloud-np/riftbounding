/** Arena Kingpin (UNL-001) — "I enter ready" (369.3 replacement); [Tap]: give a unit +3 [Might] this turn (377, 479.4). */
import { registerCardScript } from "../registry";
import { SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Arena Kingpin",
  text: "I enter ready.\n[Tap]: Give a unit +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "enter-ready", target: SELF } },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: { op: "temporary_might", amount: 3, target: aUnit() },
    },
  ],
});
