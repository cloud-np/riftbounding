/** Loyal Pup. */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Loyal Pup",
  text: "When you defend at a battlefield, you may move me there.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 383.4.f: the player-level Defender designation event (466.2.c.3).
      trigger: { kind: "event", event: { type: "defend", player: "self", data: { player: true } } },
      optional: true,
      effect: { op: "move", target: SELF, to: { kind: "chosen", ref: "event-zone" } },
    },
  ],
});
