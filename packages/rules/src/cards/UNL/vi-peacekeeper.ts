/** Vi, Peacekeeper. */
import { registerCardScript, WHEN_I_ATTACK } from "../sdk";
import { ENEMY_HERE } from "./custom";

registerCardScript({
  name: "Vi, Peacekeeper",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen I attack, [Stun] an enemy unit here. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "triggered", trigger: WHEN_I_ATTACK, effect: { op: "stun", target: ENEMY_HERE } },
  ],
});
