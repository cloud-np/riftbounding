/**
 * Vilemaw (UNL-060) — [Ambush] (822, engine keyword). "Enemy units here with less Might than me
 * don't deal combat damage." (467.2.a/b: such units contribute 0 to their side's total — a
 * `no-combat-damage` passive.) "When I hold, draw 1." (383.4.d)
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Vilemaw",
  text: "[Ambush] (You may play me as a [reaction] to a battlefield where you have units)\nEnemy units here with less Might than me don't deal combat damage.\nWhen I hold, draw 1.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "draw", amount: 1 },
    },
    {
      kind: "passive",
      modifier: {
        kind: "no-combat-damage",
        target: { cardType: "unit", where: custom("unl:weaker-enemy-here") },
      },
    },
  ],
});
