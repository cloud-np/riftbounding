/** Fiora, Worthy. */
import { EVENT_SUBJECT, registerCardScript } from "../sdk";

registerCardScript({
  name: "Fiora, Worthy",
  text: "When a unit you control becomes [Mighty], you may pay [Order] to ready it. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "become_mighty", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Order: 1 } },
        effect: { op: "ready", target: EVENT_SUBJECT },
      },
    },
  ],
});
