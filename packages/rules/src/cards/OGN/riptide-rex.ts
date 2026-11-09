/** Riptide Rex (OGN-092) — "When you play me, deal 6 to an enemy unit at a battlefield." (418, 403.2) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Riptide Rex",
  text: "When you play me, deal 6 to an enemy unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "deal",
        amount: 6,
        target: aUnit({ controller: "opponent", zone: "battlefield" }),
      },
    },
  ],
});
