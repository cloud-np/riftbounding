/**
 * Possession (OGN-203) — "[ACTION] Choose an enemy unit at a battlefield. Take control of it and
 * recall it."
 *
 * Registers `ogn-oz:take-control`: the ability's controller gains control of the referenced units
 * (no duration: it lasts while the object stays on the board). The target is chosen when playing
 * (355.7, checked again on resolution, 359.3.e); after the control change it is recalled to its new
 * controller's base (456–460: not a move).
 */
import type { Selector } from "@rift/protocol";
import { pushEvent } from "../../types";
import { RESOLVED } from "../../effects/execute";
import { controllerOf } from "../../effects/objects";
import { registerCustomEffect } from "../../effects/ops";
import { recordOutcome, targets } from "../../effects/targets";
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCustomEffect("ogn-oz:take-control", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const host = context.step.host;
  const controller = context.machine?.env.controller ?? context.controller;
  const done: string[] = [];
  for (const id of found.ids) {
    const previous = controllerOf(context.room, host, id);
    if (!previous || previous === controller) continue;
    if (!host.setController(context.room, id, controller)) continue;
    done.push(id);
    pushEvent(context.step.events, {
      type: "gain_control",
      cardId: id,
      playerId: controller,
      data: { from: previous },
    });
  }
  recordOutcome(context, done, done.length > 0);
  return RESOLVED;
});

registerCardScript({
  name: "Possession",
  text: "[ACTION] (Play on your turn or in showdowns.)\nChoose an enemy unit at a battlefield. Take control of it and recall it. (Send it to your base. This isn't a move.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "opponent", zone: "battlefield" }),
        effect: {
          op: "seq",
          effects: [
            { op: "custom", id: "ogn-oz:take-control", params: { target: { targetRef: "it" } } },
            { op: "recall", target: { targetRef: "it" } },
          ],
        },
      },
    },
  ],
});
