/**
 * Twisted Fate, Gambler (OGN-200) — "When I attack, reveal the top rune of your rune deck, then
 * recycle it. Do one of the following based on its domain: [Fury] - Deal 2 to an enemy unit here and
 * 1 to all other enemy units here. [Mind] - Draw 1. [Order] - Stun an enemy unit."
 *
 * Registers `ogn-oz:twisted-fate`: reveals the top rune (425), recycles it to the bottom of its Rune
 * Deck (417.1.b), then runs the instruction of its domain (any other domain does nothing). The enemy
 * unit for [Fury]/[Order] is chosen when that instruction is known, on resolution (355.18 fallback:
 * an unbound target is asked then, still checked for targetability, 758).
 */
import type { Effect } from "@rift/protocol";
import { pushEvent } from "../../types";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops";
import { registerCardScript } from "../registry";
import { HERE, SELF, aUnit } from "../dsl";

const BY_DOMAIN: Record<string, Effect> = {
  Fury: {
    op: "seq",
    effects: [
      {
        op: "deal",
        amount: 2,
        target: aUnit({ controller: "opponent", zone: HERE, targetRef: "tf:primary" }),
      },
      {
        op: "deal",
        amount: 1,
        target: {
          cardType: "unit",
          controller: "opponent",
          zone: HERE,
          excludeRefs: ["tf:primary"],
        },
      },
    ],
  },
  Mind: { op: "draw", amount: 1 },
  Order: { op: "stun", target: aUnit({ controller: "opponent", targetRef: "tf:stunned" }) },
};

registerCustomEffect("ogn-oz:twisted-fate", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const host = context.step.host;
  const controller = machine.env.controller;
  const [rune] = host.lookAtTop(context.room, controller, "runeDeck", 1);
  if (!rune) return RESOLVED;
  host.reveal(context.room, rune.id);
  pushEvent(context.step.events, { type: "reveal", cardId: rune.id, playerId: controller });
  const domain = host.cardInfo(context.room, rune.id)?.domains?.[0] ?? "";
  if (host.moveCardToOwnerZone(context.room, rune.id, "runeDeck", "bottom")) {
    pushEvent(context.step.events, {
      type: "recycle",
      cardId: rune.id,
      playerId: controller,
      zone: "runeDeck",
      data: { from: "runeDeck" },
    });
  }
  const effect = BY_DOMAIN[domain];
  if (effect) machine.push({ effect });
  return RESOLVED;
});

registerCardScript({
  name: "Twisted Fate, Gambler",
  text: "When I attack, reveal the top rune of your rune deck, then recycle it. Do one of the following based on its domain:\n[Fury] - Deal 2 to an enemy unit here and 1 to all other enemy units here.\n[Mind] - Draw 1.\n[Order] - Stun an enemy unit.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: SELF } },
      effect: { op: "custom", id: "ogn-oz:twisted-fate" },
    },
  ],
});
