/** Mournful Witness. */
import { HERE, registerCardScript, SELF, whileEmpowered } from "../sdk";

registerCardScript({
  name: "Mournful Witness",
  text: "When a combat that I was in ends, empower me. (I become Empowered if I'm not already.)\n[Empowered] I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 468.7.b: `combat_end` names the battlefield; every unit there was in the combat (466).
      trigger: { kind: "event", event: { type: "combat_end", zone: HERE } },
      effect: { op: "empower", target: SELF },
    },
    whileEmpowered({ kind: "might", amount: 2, target: SELF }),
  ],
});
