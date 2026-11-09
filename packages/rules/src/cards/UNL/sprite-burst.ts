/** Sprite Burst. */
import { registerCardScript, token } from "../sdk";

registerCardScript({
  name: "Sprite Burst",
  text: "Play two ready 3[Might] Sprite unit tokens with [Temporary]. (Kill each at the start of its controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "create",
        token: token("Sprite", { count: 2, might: 3, exhausted: false, play: true }),
      },
    },
  ],
});
