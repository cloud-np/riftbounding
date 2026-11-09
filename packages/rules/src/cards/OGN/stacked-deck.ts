/**
 * Stacked Deck (OGN-183) — "[Action] Look at the top 3 cards of your Main Deck. Put 1 into your hand
 * and recycle the rest."
 *
 * Registers `ogn-oz:put-in-hand`: puts the referenced cards into their owner's hand (056) without
 * drawing (414) and without a `return_to_hand` event (they never were on the board). The kept card
 * is a pick among the looked-at cards (355.18); the others are recycled (417).
 */
import type { Selector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { RESOLVED } from "../../effects/execute";
import { locate } from "../../effects/objects";
import { registerCustomEffect } from "../../effects/ops";
import { recordOutcome, targets } from "../../effects/targets";
import { registerCardScript } from "../registry";
import { custom, not } from "../dsl";

registerCustomEffect("ogn-oz:put-in-hand", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const done: string[] = [];
  for (const id of found.ids) {
    const located = locate(context.room, host, id);
    if (!located || located.zone === "hand") continue;
    if (!host.moveCardToOwnerZone(context.room, id, "hand")) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "put_in_hand",
      cardId: id,
      playerId: located.card.ownerPlayerId ?? located.playerId,
      data: { from: located.zone },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerCardScript({
  name: "Stacked Deck",
  text: "[Action] (play on your turn or in showdowns.)\nLook at the top 3 cards of your Main Deck. Put 1 into your hand and recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "look",
        amount: 3,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "kept",
              selector: { zone: "deck", owner: "self", where: custom("in-ref", { ref: "looked" }) },
              min: 1,
              max: 1,
            },
            { op: "custom", id: "ogn-oz:put-in-hand", params: { target: { targetRef: "kept" } } },
            {
              op: "recycle",
              target: { targetRef: "looked", where: not(custom("in-ref", { ref: "kept" })) },
            },
          ],
        },
      },
    },
  ],
});
