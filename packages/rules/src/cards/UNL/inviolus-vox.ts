/** Inviolus Vox. */
import { aUnit, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Inviolus Vox",
  text: "When I conquer, give a friendly unit +8 [might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "temporary_might", amount: 8, target: aUnit({ controller: "self" }) },
    },
  ],
});
