/** Lillia, Fae Fawn. */
import { registerCardScript, token, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Lillia, Fae Fawn",
  text: "[Accelerate] (You may pay [1][Mind] as an additional cost to have me enter ready.)\nWhen I move from a location, play a 3 [Might] Sprite unit token with [Temporary] there. (Kill it at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, play: true }),
        zone: { kind: "chosen", ref: "event-from" },
      },
    },
  ],
});
