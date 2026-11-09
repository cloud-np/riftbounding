/**
 * Yasuo, Remorseful (OGN-076) — "When I attack, deal damage equal to my Might to an enemy unit
 * here." (383.4.e attack trigger; 418.6.a the source is Yasuo; Might read on resolution)
 */
import { aUnit, HERE, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Yasuo, Remorseful",
  text: "When I attack, deal damage equal to my Might to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: {
        op: "deal",
        amount: { kind: "might", selector: SELF },
        target: aUnit({ controller: "opponent", zone: HERE }),
        source: SELF,
      },
    },
  ],
});
