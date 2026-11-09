/** Runeblade Anvil. */
import type { Effect } from "@rift/protocol";
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

/**
 * Runeblade Anvil (RAD-012) — "When you play this or when this leaves the board, banish the top
 * card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its
 * costs.) [2] [Fury], [Tap]: Kill this." (428, 420.1.a permission; 383.2.c.3 leave-the-board)
 */
const ANVIL_EFFECT: Effect = {
  op: "look",
  amount: 1,
  then: {
    op: "seq",
    effects: [
      { op: "banish", target: { targetRef: "looked" } },
      { op: "custom", id: "rad:may-play-until-ending", params: { ref: "looked" } },
    ],
  },
};

registerCardScript({
  name: "Runeblade Anvil",
  text: "When you play this or when this leaves the board, banish the top card of your Main Deck. Until your next Ending Phase, you may play that card. (You still pay its costs.)\n[2] [Fury], [Tap]: Kill this.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: ANVIL_EFFECT },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: ["kill", "banish", "return_to_hand", "recycle"], subject: SELF },
      },
      effect: ANVIL_EFFECT,
    },
    {
      kind: "activated",
      cost: { energy: 2, power: { Fury: 1 }, exhaust: SELF },
      effect: { op: "kill", target: SELF },
    },
  ],
});
