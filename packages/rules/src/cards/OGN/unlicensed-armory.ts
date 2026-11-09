/**
 * Unlicensed Armory (OGN-023, Origins errata) — "Discard 1, [Tap]: Choose a friendly unit. The
 * next time it would die this turn, you may pay [Fury] to heal it, exhaust it, and recall it
 * instead."
 *
 * The activation and its cost (discard 1, exhaust this; 376/357.2) are automated. The chosen unit
 * gets a delayed replacement (391.3) for its next death this turn; R3-engine holds the `kill` and
 * offers "apply/decline" (371.2), paying [Fury] through the ordinary cost layer (445).
 */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";
import { registerCustomEffect } from "../../effects/ops";
import { RESOLVED } from "../../effects/execute";

/**
 * Create the delayed optional replacement for the unit bound to `it` (359.3.f.3.a: the matcher
 * names the object when the delayed effect is created).
 */
registerCustomEffect("ogn-oz:replace-next-death-pay-fury", (_params, context) => {
  const machine = context.machine;
  const id = machine?.env.it;
  if (!machine || !id) return RESOLVED;
  machine.push({
    effect: {
      op: "replace",
      matches: { type: "kill", subject: { targetRef: `obj:${id}` } },
      replace: {
        op: "cost_then",
        optional: true,
        cost: { power: { Fury: 1 } },
        effect: {
          op: "seq",
          effects: [
            { op: "heal", amount: 99, target: { targetRef: "event" } },
            { op: "exhaust", target: { targetRef: "event" } },
            { op: "recall", target: { targetRef: "event" } },
          ],
        },
      },
    },
  });
  return RESOLVED;
});

registerCardScript({
  name: "Unlicensed Armory",
  text: "Discard 1, [Tap]: Choose a friendly unit. The next time it would die this turn, you may pay [Fury] to heal it, exhaust it, and recall it instead. (Send it to base. This isn't a move.)",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { discard: 1, exhaust: SELF },
      effect: {
        op: "for_each",
        selector: { chosen: true, targetRef: "target:0", cardType: "unit", controller: "self" },
        effect: { op: "custom", id: "ogn-oz:replace-next-death-pay-fury" },
      },
    },
  ],
});
