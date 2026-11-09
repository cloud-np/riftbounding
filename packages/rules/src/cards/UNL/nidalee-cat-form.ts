/**
 * Nidalee, Cat Form (UNL-114) — [Ambush] (822, engine keyword). "When I win a combat, draw 1."
 * (468.3.c: a unit remaining at the battlefield inherits its controller's win.)
 */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Nidalee, Cat Form",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen I win a combat, draw 1. (I win if I remain after combat.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "combat_result", condition: custom("unl:unit-won-combat", { ref: "self" }) },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
