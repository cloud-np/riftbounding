/** Demacian Illuminators (RAD-023) — "When one or more friendly units die, [buff] a friendly unit." (383.2, 810.1) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Demacian Illuminators",
  text: "When one or more friendly units die, [buff] a friendly unit. (Give it a +1[might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: { cardType: "unit", controller: "self" } },
      },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
