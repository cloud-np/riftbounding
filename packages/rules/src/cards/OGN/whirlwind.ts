/**
 * Whirlwind (OGN-187) — "Starting with the next player, each player may return a unit to its owner's
 * hand."
 *
 * Registers `ogn-oz:each-player-may-return`: in Turn Order starting with the player after the
 * controller (303.2.a), each player in turn picks up to one unit on the board (a decision made on
 * resolution, 355.18) and it returns to its owner's hand (056) before the next player decides.
 */
import type { Effect } from "@rift/protocol";
import { RESOLVED } from "../../effects/execute";
import { playersInTurnOrder } from "../../effects/evaluate";
import { registerCustomEffect } from "../../effects/ops";
import { registerCardScript } from "../registry";

registerCustomEffect("ogn-oz:each-player-may-return", (_params, context) => {
  const machine = context.machine;
  if (!machine) return RESOLVED;
  const order = playersInTurnOrder(context.room, context.step.host);
  const me = machine.env.controller;
  const start = order.indexOf(me);
  const sequence = start < 0 ? order : [...order.slice(start + 1), ...order.slice(0, start + 1)];
  const frames: Array<{ effect: Effect }> = [];
  for (const player of sequence) {
    const key = `whirlwind:${player}`;
    frames.push({
      effect: {
        op: "choose",
        key,
        selector: { cardType: "unit" },
        min: 0,
        max: 1,
        chooser: { kind: "player", id: player },
        label: "rules.prompt.mayReturnUnit",
      },
    });
    frames.push({ effect: { op: "return_to_hand", target: { targetRef: key } } });
  }
  machine.push(...frames);
  return RESOLVED;
});

registerCardScript({
  name: "Whirlwind",
  text: "Starting with the next player, each player may return a unit to its owner's hand.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "custom", id: "ogn-oz:each-player-may-return" } }],
});
