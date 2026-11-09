/** Ephemeral Ward (RAD-039) — "Your units have +2 [Might]. When you play a unit, kill this." (440.2.c: tokens are played too) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ephemeral Ward",
  text: "Your units have +2 [Might].\nWhen you play a unit, kill this.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "might", amount: 2, target: { cardType: "unit", controller: "self" } },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: { op: "kill", target: SELF },
    },
  ],
});
