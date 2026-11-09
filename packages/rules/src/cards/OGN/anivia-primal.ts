/** Anivia, Primal (OGN-148) — "When I attack, deal 3 to all enemy units here." (383.4.e; 418.1.d) */
import { HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Anivia, Primal",
  text: "When I attack, deal 3 to all enemy units here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: {
        op: "deal",
        amount: 3,
        target: { cardType: "unit", controller: "opponent", zone: HERE },
      },
    },
  ],
});
