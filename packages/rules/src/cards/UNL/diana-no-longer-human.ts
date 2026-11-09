/**
 * Diana, No Longer human (UNL-149) — [Ambush] (822, engine keyword). "When you play a spell, give
 * me +2 [Might] this turn." (420.4.a: triggers when playing the spell completes by its resolution.)
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Diana, No Longer human",
  text: "[Ambush]\nWhen you play a spell, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spell_resolved", player: "self" } },
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
