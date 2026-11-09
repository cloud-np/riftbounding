/**
 * The Harrowing (OGN-198) — "Play a unit from your trash, ignoring its Energy cost. (You must still
 * pay its Power cost.)"
 *
 * The unit is picked on resolution (355.18). Registers `ogn-oz:pay-printed-cost`: the controller
 * pays the referenced card's printed cost through R2-play's `payCost` (357), with
 * `ignoreEnergy` / `energyReduction` applied to the Energy part; its Power is paid as [C] of the
 * card's Domains (135.2.e.6, RULES-QUESTION 131.3.a). `$did` records whether it was paid. A
 * paid unit is then played ignoring its cost (420.3); an unpaid one stays where it is (358.5).
 */
import type { Cost, Effect, Selector } from "@rift/protocol";
import { RESOLVED } from "../../effects/execute";
import { registerCustomEffect } from "../../effects/ops";
import { recordOutcome, targets } from "../../effects/targets";
import { payCost } from "../../play/payment";
import { registerCardScript } from "../registry";
import { custom } from "../dsl";

registerCustomEffect("ogn-oz:pay-printed-cost", (params, context) => {
  const found = targets(context, params.target as Selector);
  if (!found.ok) return found.result;
  const id = found.ids[0];
  if (!id) {
    recordOutcome(context, [], false);
    return RESOLVED;
  }
  const info = context.step.host.cardInfo(context.room, id);
  const reduction = typeof params.energyReduction === "number" ? params.energyReduction : 0;
  const energy =
    params.ignoreEnergy === true ? 0 : Math.max(0, (info?.energyCost ?? 0) - reduction);
  const power = info?.powerCost ?? 0;
  const cost: Cost = {
    ...(energy > 0 ? { energy } : {}),
    ...(power > 0 ? { additional: { "power:self": power } } : {}),
  };
  const controller = context.machine?.env.controller ?? context.controller;
  const verdict =
    Object.keys(cost).length === 0
      ? { ok: true }
      : payCost(context.room, context.step, controller, cost, { sourceObjectId: id });
  recordOutcome(context, verdict.ok ? [id] : [], verdict.ok);
  return RESOLVED;
});

/** "Play the picked unit (bound to `key`), ignoring its Energy cost / reducing it." */
export function playPickedUnit(
  key: string,
  payment: { ignoreEnergy?: boolean; energyReduction?: number },
): Effect {
  return {
    op: "seq",
    effects: [
      {
        op: "custom" as const,
        id: "ogn-oz:pay-printed-cost",
        params: { target: { targetRef: key }, ...payment },
      },
      {
        op: "if" as const,
        condition: { kind: "did" },
        then: { op: "play" as const, target: { targetRef: key }, cost: "ignored" as const },
      },
    ],
  };
}

registerCardScript({
  name: "The Harrowing",
  text: "Play a unit from your trash, ignoring its Energy cost. (You must still pay its Power cost.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "harrowed",
            selector: { cardType: "unit", zone: "trash", owner: "self" },
            min: 1,
            max: 1,
          },
          playPickedUnit("harrowed", { ignoreEnergy: true }),
        ],
      },
    },
  ],
});
