/** Leona, Determined (OGN-238) — [Shield] (814); "When I attack, stun an enemy unit here." (383.4.e; 424) */
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit } from "../dsl";

registerCardScript({
  name: "Leona, Determined",
  text: "[SHIELD] (+1 [Might] while I'm a defender.)\nWhen I attack, stun an enemy unit here. \n(It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: { op: "stun", target: aUnit({ controller: "opponent", zone: HERE }) },
    },
  ],
});
