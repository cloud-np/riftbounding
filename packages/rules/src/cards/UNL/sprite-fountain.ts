/** Sprite Fountain. */
import { registerCardScript, WHEN_I_DIE, WHEN_PLAYED } from "../sdk";
import { READY_SPRITE_TO_BASE } from "./custom";

registerCardScript({
  name: "Sprite Fountain",
  text: "[Temporary] (Kill this at the start of its controller's Beginning Phase, before scoring.)\nWhen you play this, play a ready 3 [Might] Sprite unit token with [Temporary] to your base.\n[Deathknell] Repeat this gear's play effect. (When this dies, get the effect.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: READY_SPRITE_TO_BASE },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: READY_SPRITE_TO_BASE,
    },
  ],
});
