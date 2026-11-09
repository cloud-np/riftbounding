/**
 * Mindsplitter (OGN-192) — "When you play me, choose an opponent. They reveal their hand. Choose a
 * card from it, and they discard that card." (425 reveal; 423 discard by that player)
 *
 * The opponent is chosen on resolution (355.18; in a duel there is only one), then the controller
 * picks one card of the revealed hand and that player discards it.
 */
import { registerCardScript } from "../registry";
import { WHEN_PLAYED } from "../dsl";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";
import { opponentsOf } from "../../effects/evaluate";
import { evalContextOf, optionFor, recordOutcome } from "../../effects/targets";
import { pushEvent } from "../../types";

registerCustomEffect("ogn-an:reveal-hand-discard-chosen", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const ctx = evalContextOf(context);
  const { room, host, env } = ctx;
  const data = machine.frame.data ?? {};
  let opponent = typeof data.opponent === "string" ? data.opponent : undefined;
  if (!opponent) {
    const opponents = opponentsOf(room, host, env.controller);
    if (opponents.length === 0) return RESOLVED;
    if (opponents.length === 1) opponent = opponents[0]!;
    else if (machine.frame.answer !== undefined) {
      const answer = machine.frame.answer;
      const id = Array.isArray(answer) ? answer[0] : answer;
      machine.frame.answer = undefined;
      opponent = typeof id === "string" && opponents.includes(id) ? id : opponents[0]!;
    } else {
      return machine.ask({
        kind: "choose-opponent",
        playerId: env.controller,
        options: opponents.map((id) => ({ id, playerId: id, label: host.playerName(room, id) })),
        min: 1,
        max: 1,
        rule: "355.7",
        promptKey: "rules.prompt.chooseOpponent",
        data: { answer: "objects" },
      });
    }
    // 425: they reveal their hand.
    for (const card of host.zoneCards(room, opponent, "hand")) {
      if (host.reveal(room, card.id))
        pushEvent(context.step.events, { type: "reveal", cardId: card.id, playerId: opponent });
    }
    machine.frame.data = { opponent };
  }
  const hand = host.zoneCards(room, opponent, "hand").map((card) => card.id);
  let chosen: string | undefined;
  if (hand.length === 0) {
    machine.frame.data = undefined;
    return RESOLVED;
  }
  if (hand.length === 1) chosen = hand[0];
  else if (machine.frame.answer !== undefined) {
    const answer = machine.frame.answer;
    const id = Array.isArray(answer) ? answer[0] : answer;
    machine.frame.answer = undefined;
    chosen = typeof id === "string" && hand.includes(id) ? id : hand[0];
  } else {
    return machine.ask({
      kind: "choose-card",
      playerId: env.controller,
      options: hand.map((id) => optionFor(ctx, id)),
      min: 1,
      max: 1,
      rule: "355.18",
      promptKey: "rules.prompt.chooseDiscard",
      data: { answer: "objects" },
    });
  }
  machine.frame.data = undefined;
  if (chosen && host.moveCardToOwnerZone(room, chosen, "trash")) {
    pushEvent(context.step.events, { type: "discard", cardId: chosen, playerId: opponent });
    recordOutcome(context, [chosen], true);
  }
  return RESOLVED;
});

registerCardScript({
  name: "Mindsplitter",
  text: "When you play me, choose an opponent. They reveal their hand. Choose a card from it, and they discard that card.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "custom", id: "ogn-an:reveal-hand-discard-chosen" },
    },
  ],
});
