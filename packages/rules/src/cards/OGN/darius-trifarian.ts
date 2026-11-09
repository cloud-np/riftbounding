/**
 * Darius, Trifarian (OGN-027) — "When you play your second card in a turn, give me +2 [Might] this
 * turn and ready me." 420.4.a: the trigger fires when that card finishes being played (it
 * resolves); the condition reads the order of cards played this turn.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript, registerCustomCondition, SELF } from "../sdk";

/** The trigger event's card is the `n`-th card (1-based) its player played this turn. */
registerCustomCondition("ogn-an:nth-card-played", (ctx, params) => {
  const n = typeof params.n === "number" ? params.n : 1;
  const event = ctx.env.event;
  const player = event?.playerId ?? ctx.env.controller;
  const played = ctx.room.rules?.history.effects?.played?.[player] ?? [];
  return !!event?.cardId && played[n - 1] === event.cardId;
});

export const SECOND_CARD: Condition = {
  kind: "custom",
  id: "ogn-an:nth-card-played",
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
