/** Threshold of the Gray. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Threshold of the Gray",
  text: "When combat starts here, the attacker and defender each [add] [1].",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 466.2: the combat_begin event names the battlefield and both players.
      trigger: { kind: "event", event: { type: "combat_begin", zone: HERE } },
      effect: { op: "custom", id: "ven:combatants-add", params: { energy: 1 } },
    },
  ],
});
