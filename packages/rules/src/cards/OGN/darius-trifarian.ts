/**
 * Darius, Trifarian (OGN-027) — "When you play your second card in a turn, give me +2 [Might] this
 * turn and ready me." 420.4.a: the trigger fires when that card finishes being played (it
 * resolves); the condition reads the order of cards played this turn.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript, SELF } from "../sdk";

export const SECOND_CARD: Condition = {
  kind: "custom",
  id: "ogn:nth-card-played",
  params: { n: 2 },
};

registerCardScript({
  name: "Darius, Trifarian",
  text: "When you play your second card in a turn, give me +2 [Might] this turn and ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "played", player: "self", condition: SECOND_CARD } },
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: SELF },
          { op: "ready", target: SELF },
        ],
      },
    },
  ],
});
