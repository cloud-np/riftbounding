/** Ravenbloom Conservatory. */
import { registerCardScript, WHEN_YOU_DEFEND_HERE } from "../sdk";
import { revealTop } from "./custom";

registerCardScript({
  name: "Ravenbloom Conservatory",
  text: "When you defend here, reveal the top card of your Main Deck. If it's a spell, put it in your hand. Otherwise, recycle it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: revealTop("spell", {
        op: "custom",
        id: "sfd:to-hand-ref",
        params: { ref: "looked" },
      }),
    },
  ],
});
