/**
 * Hallowed Tomb (OGN-281, battlefield) — "When you hold here, you may return your Chosen Champion
 * from your trash to your Champion Zone if it is empty." (383.4.d.2.b; 403.1 "you may")
 * The Chosen Champion is the card set aside as such (`source: "champion"`, 103.2); the "if it is
 * empty" check is made on resolution.
 */
import { registerCardScript } from "../registry";
import { WHEN_YOU_HOLD_HERE } from "../dsl";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import { recordOutcome } from "../../effects/targets";
import { pushEvent } from "../../types";

/** Move the controller's Chosen Champion from their trash to their empty Champion Zone. */
registerCustomEffect("ogn-an:return-chosen-champion", (_params, context) => {
  const host = context.step.host;
  const player = context.machine?.env.controller ?? context.controller;
  if (host.zoneCards(context.room, player, "champion").length > 0) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const champion = host
    .zoneCards(context.room, player, "trash")
    .find((card) => card.source === "champion" && (card.ownerPlayerId ?? player) === player);
  if (!champion || !host.moveCardTo(context.room, player, "trash", "champion", champion.id)) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  pushEvent(context.step.events, {
    type: "zone_move",
    cardId: champion.id,
    playerId: player,
    cardName: champion.name,
    zone: "champion",
    data: { from: "trash" },
  });
  recordOutcome(context, [champion.id], true);
  return RESOLVED;
});

registerCardScript({
  name: "Hallowed Tomb",
  text: "When you hold here, you may return your Chosen Champion from your trash to your Champion Zone if it is empty.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      optional: true,
      effect: { op: "custom", id: "ogn-an:return-chosen-champion" },
    },
  ],
});
