/**
 * Teemo, Strategist (OGN-121, Origins errata) — "[Hidden] When I defend, choose an enemy unit here
 * and reveal the top 5 cards of your Main Deck. Deal 1 to that unit for each card with [Hidden]
 * revealed this way, then recycle the revealed cards."
 *
 * [Hidden] (811) is the play layer's. The defend trigger (383.4.f) targets an enemy unit at Teemo's
 * battlefield when it finalizes (403.2). Registers `ogn-oz:reveal-top`: reveals the top `count`
 * cards of the controller's Main Deck (425; they stay there, 425.1.a.2) and binds them to `key`.
 * One deal instruction for the number of revealed [Hidden] cards (418.8), then the revealed cards
 * are recycled (417.5 random order).
 */
import { pushEvent } from "../../types";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops";
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit } from "../dsl";

registerCustomEffect("ogn-oz:reveal-top", (params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const count = typeof params.count === "number" ? params.count : 1;
  const key = typeof params.key === "string" ? params.key : "revealed";
  const controller = machine.env.controller;
  const host = context.step.host;
  const cards = host.lookAtTop(context.room, controller, "deck", count).map((card) => card.id);
  for (const id of cards) {
    host.reveal(context.room, id);
    pushEvent(context.step.events, { type: "reveal", cardId: id, playerId: controller });
  }
  machine.env.vars[key] = cards;
  return RESOLVED;
});

registerCardScript({
  name: "Teemo, Strategist",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen I defend, choose an enemy unit here and reveal the top 5 cards of your Main Deck. Deal 1 to that unit for each card with [Hidden] revealed this way, then recycle the revealed cards.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "defend", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "custom", id: "ogn-oz:reveal-top", params: { count: 5, key: "revealed" } },
          {
            op: "deal",
            amount: { kind: "count", selector: { targetRef: "revealed", keyword: "Hidden" } },
            target: aUnit({ controller: "opponent", zone: HERE }),
          },
          { op: "recycle", target: { targetRef: "revealed" } },
        ],
      },
    },
  ],
});
