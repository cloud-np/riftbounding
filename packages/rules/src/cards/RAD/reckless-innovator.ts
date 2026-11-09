/**
 * Reckless Innovator (RAD-105) — "[Accelerate] When I become exhausted, choose one —
 * • Play a Gold gear token exhausted. • Pay [Chaos] to draw 1."
 *
 * The mode is chosen when the trigger finalizes (355.3 / 403.2). "Pay [Chaos] to draw 1" is a
 * cost within an instruction (740.4.a.2.a: paid on resolution) through R2-play's `payCost`.
 * Accelerate (805) is R2-play's optional additional cost.
 */
import { registerCardScript } from "../registry";
import { WHEN_I_BECOME_EXHAUSTED, token } from "../dsl";

registerCardScript({
  name: "Reckless Innovator",
  text: '[Accelerate] (You may pay [1] [Chaos] as an additional cost to have me enter ready.)\nWhen I become exhausted, choose one —\n• Play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")\n• Pay [Chaos] to draw 1.',
  status: "partial",
  notes: "Accelerate (805) is R2-play's; paying [Chaos] uses R2-play's payCost.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_BECOME_EXHAUSTED,
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "gold",
            label: "Play a Gold gear token exhausted",
            effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
          },
          {
            id: "draw",
            label: "Pay [Chaos] to draw 1",
            effect: {
              op: "cost_then",
              cost: { power: { Chaos: 1 } },
              optional: true,
              effect: { op: "draw", amount: 1 },
            },
          },
        ],
      },
    },
  ],
});
