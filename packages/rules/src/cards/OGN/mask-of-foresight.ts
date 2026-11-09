/**
 * Mask of Foresight (OGN-060) — "When a friendly unit attacks or defends alone, give it +1 [Might]
 * this turn." "Alone" (740.2.a) is part of the trigger condition (383.2.a.1).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, custom } from "../dsl";

registerCardScript({
  name: "Mask of Foresight",
  text: "When a friendly unit attacks or defends alone, give it +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: ["attack", "defend"],
          subject: { cardType: "unit", controller: "self" },
          condition: custom("alone", { ref: "event" }),
        },
      },
      effect: { op: "temporary_might", amount: 1, target: EVENT_SUBJECT },
    },
  ],
});
