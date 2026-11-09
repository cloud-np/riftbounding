/** Gutter Guardian (RAD-103) — [Hidden]; [Show Off] a card with [Hidden]; Add [Rune] if you did. */
import { notIntrinsic, registerCardScript, SHOWED_OFF, showOff, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Gutter Guardian",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Show Off] a card with [Hidden]. (As you play me, you may reveal such a card from your hand or pick another friendly one on the board.)\nWhen you play me, if you showed off, [Add] [Rune].",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Add"),
    showOff({ keyword: "Hidden" }),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: SHOWED_OFF,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
});
