/** Tibbers (OGS-018) — "When you play me, deal 3 damage to all units at battlefields." (383.4.a, 418; I am dealt 3 too if I'm at one) */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";

registerCardScript({
  name: "Tibbers",
  text: "When you play me, deal 3 damage to all units at battlefields.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "deal", amount: 3, target: { cardType: "unit", zone: "battlefield" } },
    },
  ],
});
