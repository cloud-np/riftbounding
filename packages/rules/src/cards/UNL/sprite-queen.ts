/** Sprite Queen. */
import { registerCardScript, WHEN_PLAYED } from "../sdk";
import { READY_SPRITE_TO_BASE } from "./custom";

registerCardScript({
  name: "Sprite Queen",
  text: "When you play me or at the start of your Beginning Phase, play a ready 3 [Might] Sprite unit token with [Temporary] to your base. (Kill them at the start of their controller's next Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    { kind: "triggered", trigger: WHEN_PLAYED, effect: READY_SPRITE_TO_BASE },
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: READY_SPRITE_TO_BASE,
    },
  ],
});
