/** Zed, Master of Shadows. */
import { registerCardScript, SELF } from "../sdk";
import { COST_GAP, disempowerAnd } from "./custom";

registerCardScript({
  name: "Zed, Master of Shadows",
  text: "When you banish a card you own, empower me. (I become Empowered if I'm not already.)\n[Action] Disempower me, [Tap]: Discard 1, then draw 1.",
  status: "partial",
  notes: COST_GAP,
  abilities: [
    {
      kind: "triggered",
      // 428: the `banish` event's player is the card's owner (the player whose zone it left).
      trigger: { kind: "event", event: { type: "banish", player: "self" } },
      effect: { op: "empower", target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["action"],
      effect: disempowerAnd({
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 1 },
        ],
      }),
    },
  ],
});
