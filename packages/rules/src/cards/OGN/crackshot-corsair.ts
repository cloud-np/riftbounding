/** Crackshot Corsair (OGN-130) — "When I attack, deal 1 to an enemy unit here." (383.4.e; 355.7) */
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Crackshot Corsair",
  text: "When I attack, deal 1 to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: { op: "deal", amount: 1, target: aUnit({ controller: "opponent", zone: HERE }) },
    },
  ],
});
